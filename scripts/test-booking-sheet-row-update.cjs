/**
 * Automated Verification Test: Booking -> Google Sheet Row Update (Columns I, J, K, L, O),
 * Queue Backoff Worker (/api/cron/sheets-sync), and error_log Alert (/api/admin/errors).
 */

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

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

/**
 * Starts a local Google Sheets API v4 server that maintains a 2D grid for
 * tab "Book time with Silvia" (Rows 1..9, Columns A..P) and handles:
 * - GET /v4/spreadsheets/:id/values/:range
 * - POST /v4/spreadsheets/:id/values:batchUpdate
 */
async function startMockGoogleSheetsV4Server(slotUuid, externalSlotId = "OAK-SESS-103") {
  const headers = [
    "Slot ID", // A (0)
    "Session Date", // B (1)
    "Start Time", // C (2)
    "End Time", // D (3)
    "Duration", // E (4)
    "Advisor", // F (5)
    "Advisor Role", // G (6)
    "Location / Format", // H (7)
    "Grantee Organization", // I (8)
    "Grantee Contact Name", // J (9)
    "Grantee Contact Email", // K (10)
    "Booking Status", // L (11)
    "Calendar Invite", // M (12)
    "Session Notes", // N (13)
    "Pre-Session Discussion Objectives", // O (14)
  ];

  // Rows 1..5 (1-indexed: Row 1 is headers, Row 4 is our target slot OAK-SESS-103)
  const grid = [
    headers,
    ["OAK-SESS-101", "Monday, 9 November 2026", "17:10", "17:40", "30m", "Silvia Guizzardi", "Senior Adviser", "1:1", "", "", "", "Available", "", "", ""],
    ["OAK-SESS-102", "Monday, 9 November 2026", "17:40", "18:10", "30m", "Silvia Guizzardi", "Senior Adviser", "1:1", "", "", "", "Available", "", "", ""],
    [slotUuid, "Tuesday, 10 November 2026", "10:00", "10:30", "30m", "Silvia Guizzardi", "Senior Adviser", "1:1", "", "", "", "Available", "", "Chat during tea break", ""],
    ["OAK-SESS-104", "Tuesday, 10 November 2026", "13:55", "14:15", "20m", "Silvia Guizzardi", "Senior Adviser", "1:1", "", "", "", "Available", "", "", ""],
  ];

  let shouldFailWrites = false;
  const batchUpdateCalls = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname.includes("/values/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          range: "'Book time with Silvia'!A1:P50",
          majorDimension: "ROWS",
          values: grid,
        })
      );
      return;
    }

    if (req.method === "POST" && url.pathname.endsWith("/values:batchUpdate")) {
      let bodyStr = "";
      req.on("data", (chunk) => (bodyStr += chunk));
      req.on("end", () => {
        if (shouldFailWrites) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: 503, message: "Simulated Sheets API outage" } }));
          return;
        }

        const body = JSON.parse(bodyStr || "{}");
        batchUpdateCalls.push(body);

        for (const entry of body.data || []) {
          const rangeStr = String(entry.range || "");
          const values = (entry.values && entry.values[0]) || [];
          // Match e.g. 'Book time with Silvia'!I4:L4 or 'Book time with Silvia'!O4
          const m = rangeStr.match(/!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
          if (m) {
            const startCol = m[1].charCodeAt(0) - 65;
            const rowNumber = parseInt(m[2], 10);
            while (grid.length < rowNumber) {
              grid.push(new Array(15).fill(""));
            }
            const targetRowArr = grid[rowNumber - 1];
            for (let i = 0; i < values.length; i++) {
              targetRowArr[startCol + i] = values[i];
            }
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            spreadsheetId: "1iCrT4uEyqf62KqS6UziQFBxLQ4ukAGWH",
            totalUpdatedCells: 5,
          })
        );
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${addr.port}`,
    grid,
    batchUpdateCalls,
    setShouldFailWrites: (v) => {
      shouldFailWrites = v;
    },
    getRowObject: (rowNumber1Based) => {
      const r = grid[rowNumber1Based - 1] || [];
      return {
        A_SlotId: r[0] || "",
        I_Organisation: r[8] || "",
        J_Name: r[9] || "",
        K_Email: r[10] || "",
        L_Status: r[11] || "",
        O_Message: r[14] || "",
      };
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
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Next server exited early with code ${code}`));
    });
  });

  return child;
}

async function main() {
  console.log("=== Testing Booking -> Google Sheet Row Update (Cols I, J, K, L, O) & Queue/Error Log ===");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Create temporary advisor + 3 slots so our 3rd slot maps to Row 4
  const testSlug = "test-row-advisor-" + Date.now();
  const { data: testAdvisor, error: advErr } = await supabase
    .from("advisors")
    .insert({
      slug: testSlug,
      full_name: "Silvia Guizzardi",
      job_title: "Senior Adviser for Impact",
      bio: "Automated test advisor for sheet row update",
      email: "bookings@uncommon.org",
      is_active: false,
    })
    .select("*")
    .single();
  assert(!advErr && testAdvisor, `Failed to create test advisor: ${advErr?.message}`);

  const { data: insertedSlots, error: slotsErr } = await supabase
    .from("slots")
    .insert([
      {
        advisor_id: testAdvisor.id,
        start_time: "2026-11-09T15:10:00+00:00",
        end_time: "2026-11-09T15:40:00+00:00",
        duration_minutes: 30,
      },
      {
        advisor_id: testAdvisor.id,
        start_time: "2026-11-09T15:40:00+00:00",
        end_time: "2026-11-09T16:10:00+00:00",
        duration_minutes: 30,
      },
      {
        advisor_id: testAdvisor.id,
        start_time: "2026-11-10T08:00:00+00:00",
        end_time: "2026-11-10T08:30:00+00:00",
        duration_minutes: 30,
        note: "Chat during tea break",
      },
    ])
    .select("*");
  assert(!slotsErr && insertedSlots?.length === 3, `Failed to create test slots: ${slotsErr?.message}`);

  const targetSlot = insertedSlots[2]; // 3rd chronological slot -> Sheet Row 4
  const sheetsServer = await startMockGoogleSheetsV4Server(targetSlot.id);
  const adminPw = process.env.ADMIN_PASSWORD || "admin";
  const nextPort = 4129;

  const testStateFile = path.join(os.tmpdir(), `oak-rowtest-state-${Date.now()}.json`);
  const testQueueFile = path.join(os.tmpdir(), `oak-rowtest-queue-${Date.now()}.json`);
  const testErrorFile = path.join(os.tmpdir(), `oak-rowtest-errors-${Date.now()}.json`);

  let nextProc = null;
  try {
    nextProc = await startNextServer(nextPort, {
      SHEETS_WEBHOOK_URL: "",
      SHEETS_WEBHOOK_SECRET: "",
      GOOGLE_SHEETS_API_BASE_URL: sheetsServer.baseUrl,
      GOOGLE_SHEET_ID: "1iCrT4uEyqf62KqS6UziQFBxLQ4ukAGWH",
      GOOGLE_SHEET_TAB_NAME: "Book time with Silvia",
      ADMIN_PASSWORD: adminPw,
      OAK_SYNC_STATE_FILE: testStateFile,
      OAK_SYNC_QUEUE_FILE: testQueueFile,
      OAK_ERROR_LOG_FILE: testErrorFile,
      OAK_SKIP_SUPABASE_FALLBACK: "1",
    });

    const baseUrl = `http://127.0.0.1:${nextPort}`;

    // 1. Create a booking and verify Columns I, J, K, L, O of Row 4 are updated immediately
    console.log("[Test 1] Booking slot #3 (Row 4) and verifying Columns I, J, K, L, O update in sheet...");
    const bookRes = await fetch(`${baseUrl}/api/meetings/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot_id: targetSlot.id,
        name: "Vincent Mugondora",
        email: "bookings@uncommon.org",
        organisation: "Uncommon",
        message: "Testing sheet row I, J, K, L, O update",
      }),
    });
    assert(bookRes.status === 201, `Expected 201 from /api/meetings/book, got ${bookRes.status}`);
    const bookData = await bookRes.json();
    assert(
      bookData.booking.sheet_sync_status === "synced",
      `Expected sheet_sync_status='synced', got '${bookData.booking.sheet_sync_status}'`
    );

    const row4 = sheetsServer.getRowObject(4);
    assert(row4.I_Organisation === "Uncommon", `Expected Col I='Uncommon', got '${row4.I_Organisation}'`);
    assert(row4.J_Name === "Vincent Mugondora", `Expected Col J='Vincent Mugondora', got '${row4.J_Name}'`);
    assert(row4.K_Email === "bookings@uncommon.org", `Expected Col K='bookings@uncommon.org', got '${row4.K_Email}'`);
    assert(row4.L_Status === "Confirmed", `Expected Col L='Confirmed', got '${row4.L_Status}'`);
    assert(
      row4.O_Message === "Testing sheet row I, J, K, L, O update",
      `Expected Col O='Testing sheet row I, J, K, L, O update', got '${row4.O_Message}'`
    );
    console.log("  -> PASS: Sheet Row 4 updated with:", JSON.stringify(row4));

    // 2. Cancel the booking and verify Row 4 resets to Available
    console.log("[Test 2] Cancelling booking and verifying Row 4 resets to Available...");
    const cancelRes = await fetch(`${baseUrl}/api/meetings/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: bookData.booking.cancel_token }),
    });
    assert(cancelRes.status === 200, `Expected 200 from /api/meetings/cancel, got ${cancelRes.status}`);
    const row4AfterCancel = sheetsServer.getRowObject(4);
    assert(row4AfterCancel.L_Status === "Available", `Expected Col L='Available', got '${row4AfterCancel.L_Status}'`);
    assert(row4AfterCancel.I_Organisation === "", `Expected Col I='', got '${row4AfterCancel.I_Organisation}'`);
    console.log("  -> PASS: Sheet Row 4 reset after cancellation:", JSON.stringify(row4AfterCancel));

    // 3. Simulate Sheets failure -> verify error_log alert + queue entry -> recover via /api/cron/sheets-sync
    console.log("[Test 3] Simulating Sheets failure, verifying error_log alert & queue backoff, then running cron worker...");
    sheetsServer.setShouldFailWrites(true);

    const bookRes2 = await fetch(`${baseUrl}/api/meetings/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot_id: targetSlot.id,
        name: "Vincent Mugondora",
        email: "bookings@uncommon.org",
        organisation: "Uncommon",
        message: "Queued booking during outage",
      }),
    });
    assert(bookRes2.status === 201, `Booking must succeed (201) even when sheet fails, got ${bookRes2.status}`);
    const bookData2 = await bookRes2.json();
    assert(bookData2.booking.sheet_sync_status === "failed", "Expected sheet_sync_status='failed' during outage");

    // Verify Super Admin Dashboard /api/admin/errors endpoint reports the unresolved error_log and failed queue item
    const errRes = await fetch(`${baseUrl}/api/admin/errors`, {
      headers: { "x-admin-password": adminPw },
    });
    assert(errRes.status === 200, `Expected 200 from /api/admin/errors, got ${errRes.status}`);
    const errJson = await errRes.json();
    assert(errJson.unresolvedCount >= 1, `Expected unresolvedCount >= 1 in error_log, got ${errJson.unresolvedCount}`);
    assert(errJson.failedQueueCount >= 1, `Expected failedQueueCount >= 1 in queue, got ${errJson.failedQueueCount}`);
    console.log(
      `  -> PASS: Outage captured in error_log (unresolvedCount=${errJson.unresolvedCount}) and sheet_sync_queue (failedQueueCount=${errJson.failedQueueCount}).`
    );

    // Restore Sheets server and trigger scheduled queue worker (/api/cron/sheets-sync?force=true)
    sheetsServer.setShouldFailWrites(false);
    const cronRes = await fetch(`${baseUrl}/api/cron/sheets-sync?force=true`, {
      headers: { "x-admin-password": adminPw },
    });
    assert(cronRes.status === 200, `Expected 200 from /api/cron/sheets-sync, got ${cronRes.status}`);
    const cronJson = await cronRes.json();
    assert(cronJson.ok === true && cronJson.succeeded >= 1, `Expected cron worker to succeed, got ${JSON.stringify(cronJson)}`);

    const row4AfterCron = sheetsServer.getRowObject(4);
    assert(row4AfterCron.L_Status === "Confirmed", `Expected Row 4 Col L='Confirmed' after cron retry`);
    assert(row4AfterCron.O_Message === "Queued booking during outage", `Expected Row 4 Col O updated after cron retry`);

    const errResAfter = await fetch(`${baseUrl}/api/admin/errors`, {
      headers: { "x-admin-password": adminPw },
    });
    const errJsonAfter = await errResAfter.json();
    assert(errJsonAfter.unresolvedCount === 0, `Expected error_log unresolvedCount=0 after successful retry, got ${errJsonAfter.unresolvedCount}`);
    console.log("  -> PASS: Cron worker synced queued booking to Row 4 and resolved error_log alert.");

    console.log("\n=== ALL SHEET ROW UPDATE & QUEUE WORKER TESTS PASSED ===");
  } finally {
    if (nextProc) nextProc.kill();
    sheetsServer.server.close();
    await supabase.from("slots").delete().eq("advisor_id", testAdvisor.id);
    await supabase.from("advisors").delete().eq("id", testAdvisor.id);
    for (const f of [testStateFile, testQueueFile, testErrorFile]) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
