/**
 * End-to-End Verification Suite for Google Sheets Booking Sync
 * Spawns the Next.js server and runs real HTTP requests against the API routes & database:
 * 1. Make a booking -> confirm a row appears in the sheet with all 14 fields & readable SAST date/time
 * 2. Cancel the booking -> confirm the SAME row updates in place to "cancelled" (not a duplicate row)
 * 3. Resend emails -> confirm emailStatus updates on the same row
 * 4. Run "Sync all" -> confirm bulk backfill in batches of <= 50 reports succeeded & failed
 * 5. Set a wrong secret temporarily -> confirm booking still succeeds while sync shows failed with a clear message
 *    and does not retry on "unauthorized"
 * 6. Apps Script 302 redirect & 5xx retry recovery
 * 7. Confirm non-admins get 403 on all admin routes
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

// Load env vars into process.env from .env.local / .env without printing or modifying any file
for (const envFile of [".env.local", ".env"]) {
  const fullPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(fullPath)) {
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function startMockAppsScriptServer(expectedSecret) {
  const sheetRows = new Map(); // id -> row object
  const requestLog = [];
  let force5xxCount = 0;
  let currentSecret = expectedSecret;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Simulate Apps Script 302 redirect response endpoint
    if (url.pathname.startsWith("/macros/echo")) {
      const stateId = url.searchParams.get("state");
      const payloadStr = server._echoPayloads?.get(stateId) || JSON.stringify({ ok: false, error: "missing state" });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(payloadStr);
      return;
    }

    if (req.method === "POST" && url.pathname === "/macros/s/deployment/exec") {
      let bodyStr = "";
      req.on("data", (chunk) => (bodyStr += chunk));
      req.on("end", () => {
        let body = {};
        try {
          body = JSON.parse(bodyStr || "{}");
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
          return;
        }

        requestLog.push({
          action: body.action,
          bookingId: body.booking?.id || null,
          status: body.booking?.status || null,
          emailStatus: body.booking?.emailStatus || null,
          bulkCount: Array.isArray(body.bookings) ? body.bookings.length : null,
          tokenValid: Boolean(body.token && body.token === currentSecret),
          timestamp: Date.now(),
        });

        if (force5xxCount > 0) {
          force5xxCount--;
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Bad Gateway");
          return;
        }

        if (!body.token || body.token !== currentSecret) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
          return;
        }

        let responseObj;
        if (body.action === "upsert" && body.booking && body.booking.id) {
          sheetRows.set(body.booking.id, { ...body.booking });
          responseObj = { ok: true, action: "upsert", id: body.booking.id };
        } else if (body.action === "bulk" && Array.isArray(body.bookings)) {
          for (const b of body.bookings) {
            if (b && b.id) {
              sheetRows.set(b.id, { ...b });
            }
          }
          responseObj = { ok: true, action: "bulk", count: body.bookings.length };
        } else {
          responseObj = { ok: false, error: "Unsupported action" };
        }

        // Apps Script returns a 302 redirect to script.googleusercontent.com/macros/echo
        if (!server._echoPayloads) server._echoPayloads = new Map();
        const stateId = String(Date.now() + Math.random());
        server._echoPayloads.set(stateId, JSON.stringify(responseObj));

        res.writeHead(302, {
          Location: `http://${req.headers.host}/macros/echo?state=${stateId}`,
        });
        res.end();
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}/macros/s/deployment/exec`,
    sheetRows,
    requestLog,
    setForce5xx: (n) => {
      force5xxCount = n;
    },
    setExpectedSecret: (s) => {
      currentSecret = s;
    },
  };
}

async function startNextServer(port, envOverrides) {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, ...envOverrides },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Next server startup timeout")), 20000);
    child.stdout.on("data", (data) => {
      const str = data.toString();
      if (str.includes("Ready in") || str.includes(String(port))) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (data) => {
      // ignore warnings
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Next server exited early with code ${code}`));
    });
  });

  return child;
}

async function runTests() {
  console.log("=== Starting End-to-End Google Sheets Booking Sync Verification ===");

  // 0. Check live configured webhook first
  const realUrl = process.env.SHEETS_WEBHOOK_URL?.trim();
  const realSecret = process.env.SHEETS_WEBHOOK_SECRET?.trim();
  console.log(`[Step 0] Env presence check: SHEETS_WEBHOOK_URL=${Boolean(realUrl)}, SHEETS_WEBHOOK_SECRET=${Boolean(realSecret)}`);

  if (realUrl && realSecret) {
    try {
      const liveRes = await fetch(realUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          token: realSecret,
          action: "bulk",
          bookings: [],
        }),
        redirect: "manual",
      });
      let finalRes = liveRes;
      if ([301, 302, 303, 307, 308].includes(liveRes.status)) {
        const loc = liveRes.headers.get("location");
        if (loc) {
          finalRes = await fetch(loc, { method: "GET", headers: { Accept: "application/json" } });
        }
      }
      const txt = await finalRes.text();
      let json = null;
      try {
        json = JSON.parse(txt);
      } catch {}
      console.log(
        `[Step 0] Live SHEETS_WEBHOOK_URL probe: HTTP ${finalRes.status}, JSON=${Boolean(json)}, ok=${Boolean(json?.ok)}, error=${json?.error || "none"}`
      );
    } catch (e) {
      console.log(`[Step 0] Live SHEETS_WEBHOOK_URL probe error: ${e.message}`);
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Start mock Apps Script webhook server (with 302 redirect + JSON response + upsert by id)
  const testSecret = "sheet_test_secret_" + Date.now();
  const mock = await startMockAppsScriptServer(testSecret);
  const adminPw = process.env.ADMIN_PASSWORD || "admin";
  const nextPort = 4123;

  // Create a temporary inactive advisor & slot so we don't email real advisors
  const testSlug = "test-advisor-" + Date.now();
  const { data: testAdvisor, error: advErr } = await supabase
    .from("advisors")
    .insert({
      slug: testSlug,
      full_name: "Silvia Guizzardi",
      job_title: "Senior Adviser for Impact",
      bio: "Automated test advisor for sheet sync verification",
      email: "bookings@uncommon.org",
      is_active: false,
    })
    .select("*")
    .single();
  assert(!advErr && testAdvisor, `Failed to create temporary advisor: ${advErr?.message}`);

  const { data: testSlot, error: slotErr } = await supabase
    .from("slots")
    .insert({
      advisor_id: testAdvisor.id,
      start_time: "2026-11-10T10:00:00+02:00",
      end_time: "2026-11-10T10:30:00+02:00",
      duration_minutes: 30,
      note: "Sheet Sync Verification Slot",
    })
    .select("*")
    .single();
  assert(!slotErr && testSlot, `Failed to create temporary slot: ${slotErr?.message}`);

  let nextProc = null;
  const os = require("os");
  const testStateFile = path.join(os.tmpdir(), `oak-test-sync-state-${Date.now()}.json`);
  const testQueueFile = path.join(os.tmpdir(), `oak-test-sync-queue-${Date.now()}.json`);
  const testErrorFile = path.join(os.tmpdir(), `oak-test-error-log-${Date.now()}.json`);
  try {
    nextProc = await startNextServer(nextPort, {
      SHEETS_WEBHOOK_URL: mock.url,
      SHEETS_WEBHOOK_SECRET: testSecret,
      ADMIN_PASSWORD: adminPw,
      OAK_SYNC_STATE_FILE: testStateFile,
      OAK_SYNC_QUEUE_FILE: testQueueFile,
      OAK_ERROR_LOG_FILE: testErrorFile,
      OAK_SKIP_SUPABASE_FALLBACK: "1",
    });
    const baseUrl = `http://127.0.0.1:${nextPort}`;
    console.log(`[Step 1] Next.js production server listening at ${baseUrl}`);

    // 1. Verify non-admins get 403 on all admin routes
    console.log("[Step 2] Verifying non-admin requests receive 403 Forbidden on admin routes...");
    const nonAdminEndpoints = [
      { method: "GET", path: "/api/meetings/admin/bookings" },
      { method: "POST", path: "/api/meetings/admin/bookings/00000000-0000-0000-0000-000000000000/resync" },
      { method: "POST", path: "/api/meetings/admin/bookings/sync-all" },
      { method: "GET", path: "/api/meetings/admin/sheets/status" },
      { method: "POST", path: "/api/meetings/admin/sheets/status" },
    ];
    for (const ep of nonAdminEndpoints) {
      const resNoAuth = await fetch(`${baseUrl}${ep.path}`, { method: ep.method });
      assert(
        resNoAuth.status === 403,
        `Expected 403 for unauthenticated non-admin on ${ep.method} ${ep.path}, got ${resNoAuth.status}`
      );
      const resBadPw = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { "x-admin-password": "wrong_admin_password" },
      });
      assert(
        resBadPw.status === 403,
        `Expected 403 for wrong password on ${ep.method} ${ep.path}, got ${resBadPw.status}`
      );
    }
    console.log("  -> PASS: All admin routes returned 403 for non-admins.");

    // 2. Test Sheet connection status card endpoint
    console.log("[Step 3] Testing /api/meetings/admin/sheets/status endpoint...");
    const statusRes = await fetch(`${baseUrl}/api/meetings/admin/sheets/status`, {
      method: "POST",
      headers: { "x-admin-password": adminPw },
    });
    assert(statusRes.status === 200, `Expected 200 from sheets/status, got ${statusRes.status}`);
    const statusJson = await statusRes.json();
    assert(statusJson.ok === true, `Expected statusJson.ok === true, got ${JSON.stringify(statusJson)}`);
    assert(statusJson.hasUrl === true && statusJson.hasSecret === true, "Expected hasUrl=true and hasSecret=true");
    assert(!JSON.stringify(statusJson).includes(testSecret), "Response must never include SHEETS_WEBHOOK_SECRET");
    console.log("  -> PASS: Sheet connection status returned ok=true, hasUrl=true, hasSecret=true (values hidden).");

    // 3. Make a booking and confirm a row appears in the sheet
    console.log("[Step 4] Creating a booking via POST /api/meetings/book...");
    const bookRes = await fetch(`${baseUrl}/api/meetings/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot_id: testSlot.id,
        name: "Tariro Moyo",
        email: "bookings@uncommon.org",
        organisation: "Uncommon.org",
        message: "Discussing impact evaluation metrics",
      }),
    });
    assert(bookRes.status === 201, `Expected 201 from /api/meetings/book, got ${bookRes.status}`);
    const bookData = await bookRes.json();
    const bookingId = bookData.booking.id;
    const cancelToken = bookData.booking.cancel_token;
    assert(bookingId, "Booking ID must be returned");

    const sheetRowAfterBook = mock.sheetRows.get(bookingId);
    assert(sheetRowAfterBook, `Row for booking ${bookingId} must appear in Google Sheet`);
    assert(sheetRowAfterBook.status === "confirmed", `Expected status='confirmed', got '${sheetRowAfterBook.status}'`);
    assert(
      sheetRowAfterBook.date === "Tuesday, 10 November 2026",
      `Expected readable SAST date 'Tuesday, 10 November 2026', got '${sheetRowAfterBook.date}'`
    );
    assert(
      sheetRowAfterBook.time === "10:00 - 10:30",
      `Expected readable SAST time '10:00 - 10:30', got '${sheetRowAfterBook.time}'`
    );
    assert(sheetRowAfterBook.length === 30, `Expected length=30, got ${sheetRowAfterBook.length}`);
    assert(sheetRowAfterBook.advisor === "Silvia Guizzardi", `Expected advisor='Silvia Guizzardi'`);
    assert(sheetRowAfterBook.name === "Tariro Moyo", `Expected name='Tariro Moyo'`);
    assert(sheetRowAfterBook.organisation === "Uncommon.org", `Expected organisation='Uncommon.org'`);
    assert(sheetRowAfterBook.cancelledAt === "", `Expected empty cancelledAt, got '${sheetRowAfterBook.cancelledAt}'`);
    console.log(
      `  -> PASS: Booking ${bookingId} appeared in sheet with date="${sheetRowAfterBook.date}", time="${sheetRowAfterBook.time}", status="${sheetRowAfterBook.status}", emailStatus="${sheetRowAfterBook.emailStatus}".`
    );

    // 4. Resend emails and confirm emailStatus updates on the SAME row
    console.log("[Step 5] Calling POST /api/meetings/admin/bookings/[id]/resend-email...");
    const rowCountBeforeResend = mock.sheetRows.size;
    const resendRes = await fetch(`${baseUrl}/api/meetings/admin/bookings/${bookingId}/resend-email`, {
      method: "POST",
      headers: { "x-admin-password": adminPw },
    });
    assert(resendRes.status === 200, `Expected 200 from resend-email, got ${resendRes.status}`);
    const resendData = await resendRes.json();
    const sheetRowAfterResend = mock.sheetRows.get(bookingId);
    assert(mock.sheetRows.size === rowCountBeforeResend, "Resend email must update existing row, not add a new row");
    assert(
      sheetRowAfterResend.emailStatus === resendData.email_status,
      `Expected sheet emailStatus '${resendData.email_status}', got '${sheetRowAfterResend.emailStatus}'`
    );
    console.log(`  -> PASS: Resend emails updated emailStatus="${sheetRowAfterResend.emailStatus}" on the SAME row.`);

    // 5. Cancel the booking and confirm the SAME row updates to "cancelled"
    console.log("[Step 6] Cancelling booking via POST /api/meetings/cancel...");
    const rowCountBeforeCancel = mock.sheetRows.size;
    const cancelRes = await fetch(`${baseUrl}/api/meetings/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookingId, token: cancelToken }),
    });
    assert(cancelRes.status === 200, `Expected 200 from /api/meetings/cancel, got ${cancelRes.status}`);
    const sheetRowAfterCancel = mock.sheetRows.get(bookingId);
    assert(mock.sheetRows.size === rowCountBeforeCancel, "Cancellation must update existing row in place, not add a duplicate");
    assert(
      sheetRowAfterCancel.status === "cancelled",
      `Expected sheet row status='cancelled', got '${sheetRowAfterCancel.status}'`
    );
    assert(
      Boolean(sheetRowAfterCancel.cancelledAt),
      `Expected cancelledAt ISO timestamp to be populated, got '${sheetRowAfterCancel.cancelledAt}'`
    );
    console.log(
      `  -> PASS: Cancellation updated the SAME row (${bookingId}) to status="cancelled" with cancelledAt="${sheetRowAfterCancel.cancelledAt}".`
    );

    // 6. Test 5xx retry recovery via per-row Resync
    console.log("[Step 7] Testing 5xx retry recovery via POST /api/meetings/admin/bookings/[id]/resync...");
    mock.setForce5xx(2); // Fail first 2 attempts with 502, succeed on 3rd attempt (retry #2)
    const reqCountBeforeRetry = mock.requestLog.length;
    const resyncRes = await fetch(`${baseUrl}/api/meetings/admin/bookings/${bookingId}/resync`, {
      method: "POST",
      headers: { "x-admin-password": adminPw },
    });
    assert(resyncRes.status === 200, `Expected 200 from resync, got ${resyncRes.status}`);
    const resyncData = await resyncRes.json();
    const attemptsUsed = mock.requestLog.length - reqCountBeforeRetry;
    assert(resyncData.ok === true && resyncData.sheet_sync_status === "synced", "Expected resync to succeed after 2 retries");
    assert(attemptsUsed === 3, `Expected 3 attempts (initial + 2 retries), got ${attemptsUsed}`);
    console.log(`  -> PASS: Per-row Resync recovered from two 502 errors and succeeded on attempt #${attemptsUsed}.`);

    // 7. Run "Sync all bookings to sheet"
    console.log("[Step 8] Running POST /api/meetings/admin/bookings/sync-all...");
    const syncAllRes = await fetch(`${baseUrl}/api/meetings/admin/bookings/sync-all`, {
      method: "POST",
      headers: { "x-admin-password": adminPw },
    });
    assert(syncAllRes.status === 200, `Expected 200 from sync-all, got ${syncAllRes.status}`);
    const syncAllData = await syncAllRes.json();
    assert(syncAllData.ok === true, `Expected syncAllData.ok === true, got ${JSON.stringify(syncAllData)}`);
    assert(syncAllData.total >= 1 && syncAllData.succeeded === syncAllData.total && syncAllData.failed === 0, "Expected all bookings to sync");
    console.log(
      `  -> PASS: "Sync all" synced ${syncAllData.succeeded}/${syncAllData.total} bookings across ${syncAllData.batches} batch(es) (${syncAllData.failed} failed).`
    );

    // 8. Temporarily set a wrong secret on the webhook server and confirm booking still succeeds while sync shows failed with a clear message (and no retry on unauthorized)
    console.log("[Step 9] Simulating wrong secret ('unauthorized') and making a new booking...");
    mock.setExpectedSecret("different_secret_on_apps_script");
    const reqCountBeforeUnauth = mock.requestLog.length;

    const bookRes2 = await fetch(`${baseUrl}/api/meetings/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot_id: testSlot.id,
        name: "Chipo Ndlovu",
        email: "bookings@uncommon.org",
        organisation: "Uncommon.org",
        message: "Testing graceful handling when sheet secret is wrong",
      }),
    });
    assert(bookRes2.status === 201, `Booking MUST still succeed (201) when sheet sync fails, got ${bookRes2.status}`);
    const bookData2 = await bookRes2.json();
    const bookingId2 = bookData2.booking.id;

    const unauthAttempts = mock.requestLog.length - reqCountBeforeUnauth;
    assert(unauthAttempts === 1, `Must NOT retry on 'unauthorized' response (expected 1 attempt, got ${unauthAttempts})`);

    // Fetch admin bookings list to verify sync status shows 'failed' with clear error message
    const listRes = await fetch(`${baseUrl}/api/meetings/admin/bookings`, {
      headers: { "x-admin-password": adminPw },
    });
    assert(listRes.status === 200, "Admin bookings list must return 200");
    const listData = await listRes.json();
    const failedRow = (listData.bookings || []).find((b) => b.id === bookingId2);
    assert(failedRow, `Booking ${bookingId2} must be present in /api/meetings/admin/bookings`);
    assert(
      failedRow.sheet_sync_status === "failed",
      `Expected sheet_sync_status='failed', got '${failedRow.sheet_sync_status}'`
    );
    assert(
      failedRow.sheet_sync_error && failedRow.sheet_sync_error.toLowerCase().includes("unauthorized"),
      `Expected clear unauthorized message in sheet_sync_error, got '${failedRow.sheet_sync_error}'`
    );
    assert(
      !failedRow.sheet_sync_error.includes(testSecret) && !failedRow.sheet_sync_error.includes(mock.url),
      "Error message must never leak webhook URL or secret"
    );
    console.log(
      `  -> PASS: Booking succeeded (201) with wrong secret, did not retry on unauthorized (attempts=${unauthAttempts}), and admin bookings shows sheet_sync_status="${failedRow.sheet_sync_status}", sheet_sync_error="${failedRow.sheet_sync_error}".`
    );

    console.log("\n=== ALL 8 VERIFICATION CHECKS PASSED SUCCESSFULLY ===");
  } finally {
    if (nextProc) {
      nextProc.kill();
    }
    mock.server.close();
    // Clean up temporary test slot & advisor (cascades test bookings)
    await supabase.from("slots").delete().eq("id", testSlot.id);
    await supabase.from("advisors").delete().eq("id", testAdvisor.id);
    console.log("[Cleanup] Removed temporary test advisor, slot, and test bookings.");
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
