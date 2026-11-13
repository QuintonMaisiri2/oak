/**
 * Diagnostic & Verification Script for Google Sheets Apps Script Webhook ("ping" & 401 error_log)
 * Usage: node scripts/ping-sheets-webhook.cjs
 *
 * - Section 2 is a local [MOCK] unit test of secret trimming, constant-time match, and 401 error_log.
 * - Section 3 is the [LIVE] probe against SHEETS_WEBHOOK_URL and https://oak.uncommon.org,
 *   which DECIDES the script's overall PASS (exit 0) or FAIL (exit 1).
 * - Never prints or logs the secret or URL — logs ONLY the secret's length.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m && !process.env[m[1]]) {
          let val = m[2] || "";
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          process.env[m[1]] = val;
        }
      }
    }
  }
}

function normalizeSecret(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/[\r\n]+/g, "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).replace(/[\r\n]+/g, "").trim();
  }
  return s.replace(/\\r|\\n/g, "").trim();
}

function constantTimeEqual(a, b) {
  const cleanA = normalizeSecret(a);
  const cleanB = normalizeSecret(b);
  if (!cleanA || !cleanB) return false;
  const digestA = crypto.createHash("sha256").update(cleanA, "utf8").digest();
  const digestB = crypto.createHash("sha256").update(cleanB, "utf8").digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function run() {
  loadEnv();

  const rawUrl = (process.env.SHEETS_WEBHOOK_URL || "").replace(/[\r\n]+/g, "").trim();
  const cleanSecret = normalizeSecret(process.env.SHEETS_WEBHOOK_SECRET);
  const urlEndsWithExec = Boolean(rawUrl) && /\/exec(?:\?.*)?$/i.test(rawUrl);

  console.log("=== 1. Secret & URL Diagnostic Fingerprint (Length Only) ===");
  console.log("  SHEETS_WEBHOOK_URL present   :", Boolean(rawUrl));
  console.log("  URL ends in /exec            :", urlEndsWithExec);
  console.log("  SHEETS_WEBHOOK_SECRET length :", cleanSecret.length);

  // ---------------------------------------------------------------------------
  // 2. [MOCK] Local Unit Test: Constant-Time Match, Trimming, "ping", & 401 error_log
  // ---------------------------------------------------------------------------
  console.log(
    "\n=== 2. [MOCK] Local Mock Unit Test (Not Live Sheet): Trimming, 'ping' & 401 error_log ==="
  );
  const mockPort = 4238;
  const appPort = 4239;
  const expectedMockSecret = "test-secret-with-31-characters!";
  let simulateUnauthorized = false;

  const mockWebhookServer = http.createServer((req, res) => {
    let bodyStr = "";
    req.on("data", (chunk) => (bodyStr += chunk));
    req.on("end", () => {
      try {
        const body = JSON.parse(bodyStr || "{}");
        const providedToken = normalizeSecret(body.token);
        const scriptExpected = normalizeSecret(`  ${expectedMockSecret}\r\n `);

        if (simulateUnauthorized || !constantTimeEqual(providedToken, scriptExpected)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: false,
              status: 401,
              error: "unauthorized",
              cause: "secret mismatch or stale deployment",
              scriptVersion: "2026.11.04-v3",
            })
          );
          return;
        }

        if (body.action === "ping") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              action: "ping",
              scriptVersion: "2026.11.04-v3",
              sheetTabName: "1-on-1 Booking Tracker",
              allTabs: ["1-on-1 Booking Tracker", "Bookings"],
            })
          );
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  });

  await new Promise((resolve) => mockWebhookServer.listen(mockPort, "127.0.0.1", resolve));

  const nextStart = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const testAdminPw = "test-admin-pw-ping";
  const errorLogFile = path.join(process.cwd(), ".tmp-test-ping-error-log.json");
  try {
    if (fs.existsSync(errorLogFile)) fs.unlinkSync(errorLogFile);
  } catch {}

  const childEnv = {
    ...process.env,
    PORT: String(appPort),
    ADMIN_PASSWORD: testAdminPw,
    SHEETS_WEBHOOK_SECRET: `  "${expectedMockSecret}\\r\\n"  `,
    SHEETS_WEBHOOK_URL: `http://127.0.0.1:${mockPort}/macros/s/MOCK_DEPLOY_ID/exec`,
    OAK_ERROR_LOG_FILE: errorLogFile,
    OAK_SKIP_SUPABASE_FALLBACK: "1",
  };

  const nextProc = spawn(process.execPath, [nextStart, "start", "-p", String(appPort)], {
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(`http://127.0.0.1:${appPort}/api/meetings/slots`);

    const pingRes = await fetch(
      `http://127.0.0.1:${appPort}/api/meetings/admin/sheets/status`,
      {
        method: "POST",
        headers: { "x-admin-password": testAdminPw },
      }
    );
    assert(pingRes.status === 200, `Expected HTTP 200 from status POST, got ${pingRes.status}`);
    const pingJson = await pingRes.json();
    assert(pingJson.ok === true, `Expected mock ping ok: true, got ${JSON.stringify(pingJson)}`);
    assert(
      pingJson.scriptVersion === "2026.11.04-v3",
      `Expected mock scriptVersion "2026.11.04-v3", got ${pingJson.scriptVersion}`
    );
    assert(
      pingJson.sheetTabName === "1-on-1 Booking Tracker",
      `Expected mock sheetTabName "1-on-1 Booking Tracker", got ${pingJson.sheetTabName}`
    );
    assert(
      pingJson.secretLength === expectedMockSecret.length,
      `Expected mock trimmed secretLength ${expectedMockSecret.length}, got ${pingJson.secretLength}`
    );
    assert(
      pingJson.secretPrefix === undefined,
      `Expected secretPrefix to be omitted, got ${pingJson.secretPrefix}`
    );
    console.log(
      `  [MOCK] PASS (Ping & Trimming): mockOk=${pingJson.ok}, scriptVersion="${pingJson.scriptVersion}", sheetTabName="${pingJson.sheetTabName}", mockSecret(len=${pingJson.secretLength})`
    );

    simulateUnauthorized = true;
    const unauthRes = await fetch(
      `http://127.0.0.1:${appPort}/api/meetings/admin/sheets/status?action=ping`,
      {
        headers: { "x-admin-password": testAdminPw },
      }
    );
    const unauthJson = await unauthRes.json();
    assert(unauthJson.ok === false, "Expected mock ok: false on 401 unauthorized");
    assert(
      unauthJson.cause === "secret mismatch or stale deployment",
      `Expected mock cause "secret mismatch or stale deployment", got ${unauthJson.cause}`
    );

    const errApiRes = await fetch(`http://127.0.0.1:${appPort}/api/admin/errors`, {
      headers: { "x-admin-password": testAdminPw },
    });
    const errApiJson = await errApiRes.json();
    const matchingErr = (errApiJson.errors || []).find(
      (e) =>
        e.source === "sheets_webhook_auth" &&
        e.details &&
        e.details.cause === "secret mismatch or stale deployment"
    );
    assert(
      Boolean(matchingErr),
      `Expected mock error_log entry with cause "secret mismatch or stale deployment", got ${JSON.stringify(
        errApiJson.errors
      )}`
    );
    console.log(
      `  [MOCK] PASS (401 error_log Alert): recorded source="${matchingErr.source}", cause="${matchingErr.details.cause}"`
    );
  } finally {
    nextProc.kill();
    mockWebhookServer.close();
    try {
      if (fs.existsSync(errorLogFile)) fs.unlinkSync(errorLogFile);
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // 3. [LIVE] Probe: Local -> Live SHEETS_WEBHOOK_URL & Deployed App (Decides PASS/FAIL)
  // ---------------------------------------------------------------------------
  console.log("\n=== 3. [LIVE] Webhook 'ping' Probe (Decides Overall PASS / FAIL) ===");
  let liveAppsScriptOk = false;
  let deployedAppOk = false;

  if (rawUrl && cleanSecret) {
    try {
      const livePingRes = await fetch(rawUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          token: cleanSecret,
          action: "ping",
          tabName: "1-on-1 Booking Tracker",
        }),
        redirect: "follow",
      });
      const liveText = await livePingRes.text();
      let liveJson = null;
      try {
        liveJson = JSON.parse(liveText);
      } catch {}
      liveAppsScriptOk = Boolean(liveJson && liveJson.ok === true);
      console.log(
        `  [LIVE] Local -> Apps Script 'ping' [${liveAppsScriptOk ? "PASS" : "FAIL"}] (HTTP ${
          livePingRes.status
        }): ${liveText.slice(0, 300)}`
      );
    } catch (err) {
      console.log(`  [LIVE] Local -> Apps Script 'ping' [FAIL] network error: ${err.message}`);
    }
  } else {
    console.log("  [LIVE] Local -> Apps Script 'ping' [FAIL]: Missing SHEETS_WEBHOOK_URL or SHEETS_WEBHOOK_SECRET");
  }

  try {
    const headers = {};
    if (process.env.CRON_SECRET) {
      headers["Authorization"] = `Bearer ${normalizeSecret(process.env.CRON_SECRET)}`;
    } else if (process.env.ADMIN_PASSWORD) {
      headers["x-admin-password"] = process.env.ADMIN_PASSWORD.trim();
    }
    const prodRes = await fetch(
      "https://oak.uncommon.org/api/meetings/admin/sheets/status?action=ping",
      {
        headers,
      }
    );
    const prodText = await prodRes.text();
    let prodJson = null;
    try {
      prodJson = JSON.parse(prodText);
    } catch {}
    deployedAppOk = Boolean(prodJson && prodJson.ok === true);
    console.log(
      `  [LIVE] Deployed App (oak.uncommon.org) 'ping' [${
        deployedAppOk ? "PASS" : "FAIL"
      }] (HTTP ${prodRes.status}): ${prodText.slice(0, 300)}`
    );
  } catch (err) {
    console.log(`  [LIVE] Deployed App probe [FAIL]: ${err.message}`);
  }

  const overallPass = liveAppsScriptOk && deployedAppOk;
  console.log(
    `\n=== OVERALL LIVE PING RESULT: ${
      overallPass ? "PASS" : "FAIL"
    } (liveAppsScriptOk=${liveAppsScriptOk}, deployedAppOk=${deployedAppOk}) ===`
  );

  if (!overallPass) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Ping verification failed:", err);
  process.exit(1);
});
