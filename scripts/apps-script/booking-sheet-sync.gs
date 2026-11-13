/**
 * OAK 1:1 booking sync — Google Apps Script web app (paste into Extensions > Apps Script > Code.gs).
 *
 * Writes app bookings into per-adviser tabs laid out like the "Booking time with Oak staff" sheet:
 *
 *   Date | Time | Length of meeting | Name of the person booking | Email of the person booking
 *        | Organisation | Brief description of what you would like to discuss...
 *
 * - Each adviser has their own tab whose name contains their first name, e.g. "Bookings Silvia",
 *   "Bookings Alice".
 * - Each slot is a pre-filled row (Date, Time, Length). A booking fills the booker columns of the
 *   row whose day + start time match; a cancellation clears them so the slot reads as free again.
 * - Columns are found by their header text, so their order/letters don't matter.
 * - If the slot row is already filled by someone else (e.g. typed in by hand), the booking is added
 *   as a new highlighted row underneath instead of overwriting it.
 *
 * Requires Script Property WEBHOOK_SECRET = the app's SHEETS_WEBHOOK_SECRET.
 */

const SCRIPT_VERSION = "2026.11.04-per-adviser-v2";

const HEADER_MATCHERS = {
  date: "date",
  time: "time",
  length: "length",
  name: "name of the person booking",
  email: "email of the person booking",
  organisation: "organisation",
  message: "brief description",
};

const BOOKED_BACKGROUND = "#dcfce7";
const CLASH_BACKGROUND = "#fee2e2";

function normalizeSecret(val) {
  if (val == null) return "";
  var s = String(val).replace(/[\r\n]+/g, "").trim();
  if (
    (s.indexOf('"') === 0 && s.lastIndexOf('"') === s.length - 1) ||
    (s.indexOf("'") === 0 && s.lastIndexOf("'") === s.length - 1)
  ) {
    s = s.slice(1, -1).replace(/[\r\n]+/g, "").trim();
  }
  return s.replace(/\\r|\\n/g, "").trim();
}

function constantTimeSecretMatch(a, b) {
  if (!a || !b) return false;
  var strA = String(a);
  var strB = String(b);
  var digestA = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    strA,
    Utilities.Charset.UTF_8
  );
  var digestB = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    strB,
    Utilities.Charset.UTF_8
  );
  if (digestA.length !== digestB.length) return false;
  var diff = strA.length ^ strB.length;
  for (var i = 0; i < digestA.length; i++) {
    diff |= digestA[i] ^ digestB[i];
  }
  return diff === 0;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

// Formula-injection protection: prefix strings starting with =, +, -, or @ with an apostrophe
function sanitizeCell(value) {
  const str = String(value == null ? "" : value);
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

function norm(value) {
  return String(value == null ? "" : value).toLowerCase().replace(/\s+/g, " ").trim();
}

/** "Monday, 9 November 2026" + "17:10 - 17:40" -> "9|17:10". Tolerates "10:00 -10:30 (chat...)". */
function slotKey(dateText, timeText) {
  const day = (String(dateText).match(/\b(\d{1,2})\b/) || [])[1];
  const time = String(timeText).match(/(\d{1,2})[:.](\d{2})/);
  if (!day || !time) return "";
  return Number(day) + "|" + ("0" + Number(time[1])).slice(-2) + ":" + time[2];
}

function findAdvisorSheet(ss, advisorName) {
  const parts = norm(advisorName).split(" ").filter(Boolean);
  const sheets = ss.getSheets();
  for (let i = 0; i < parts.length; i++) {
    const match = sheets.find(function (s) { return norm(s.getName()).indexOf(parts[i]) !== -1; });
    if (match) return match;
  }
  return null;
}

function readLayout(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  for (let r = 0; r < values.length; r++) {
    const row = values[r].map(norm);
    const col = function (key) {
      return row.findIndex(function (cell) { return cell.indexOf(HEADER_MATCHERS[key]) === 0; });
    };
    if (row.indexOf("date") !== -1 && row.indexOf("time") !== -1) {
      return {
        values: values,
        headerRow: r,
        date: row.indexOf("date"),
        time: row.indexOf("time"),
        length: col("length"),
        name: col("name"),
        email: col("email"),
        organisation: col("organisation"),
        message: col("message"),
      };
    }
  }
  return null;
}

function setCell(sheet, row1, col0, value) {
  if (col0 === -1) return;
  sheet.getRange(row1, col0 + 1).setNumberFormat("@").setValue(value);
}

function writeBooker(sheet, layout, row1, booking, background) {
  setCell(sheet, row1, layout.name, sanitizeCell(booking.name));
  setCell(sheet, row1, layout.email, sanitizeCell(booking.email));
  setCell(sheet, row1, layout.organisation, sanitizeCell(booking.organisation));
  setCell(sheet, row1, layout.message, sanitizeCell(booking.message));
  [layout.name, layout.email, layout.organisation, layout.message].forEach(function (col0) {
    if (col0 !== -1) sheet.getRange(row1, col0 + 1).setBackground(background);
  });
}

function appendSlotRow(sheet, layout, booking) {
  const row1 = sheet.getLastRow() + 1;
  setCell(sheet, row1, layout.date, sanitizeCell(booking.date));
  setCell(sheet, row1, layout.time, sanitizeCell(booking.time));
  setCell(sheet, row1, layout.length, (Number(booking.length) || 30) + " min");
  return row1;
}

/** Applies one booking payload from the app. Returns { status, rowWritten, tabName }. */
function applyBooking(ss, booking) {
  const sheet = findAdvisorSheet(ss, booking.advisor);
  if (!sheet) throw new Error('No tab found for adviser "' + booking.advisor + '" (tab name must contain their first name)');
  const layout = readLayout(sheet);
  if (!layout) throw new Error('Could not find the "Date" / "Time" header row in tab "' + sheet.getName() + '"');
  if (layout.name === -1 || layout.email === -1) {
    throw new Error('Tab "' + sheet.getName() + '" needs "Name of the person booking" and "Email of the person booking" columns');
  }

  const key = slotKey(booking.date, booking.time);
  const bookerEmail = norm(booking.email);
  const cancelled = norm(booking.status) === "cancelled";

  // Rows for this slot: the pre-filled slot row plus any clash rows added underneath
  const rows = [];
  for (let r = layout.headerRow + 1; r < layout.values.length; r++) {
    if (key && slotKey(layout.values[r][layout.date], layout.values[r][layout.time]) === key) rows.push(r);
  }

  const mine = rows.find(function (r) { return norm(layout.values[r][layout.email]) === bookerEmail; });

  if (cancelled) {
    if (mine === undefined) return { status: "nothing to clear", rowWritten: null, tabName: sheet.getName() };
    writeBooker(sheet, layout, mine + 1, { name: "", email: "", organisation: "", message: "" }, null);
    return { status: "cleared", rowWritten: mine + 1, tabName: sheet.getName() };
  }

  if (mine !== undefined) {
    writeBooker(sheet, layout, mine + 1, booking, BOOKED_BACKGROUND);
    return { status: "updated", rowWritten: mine + 1, tabName: sheet.getName() };
  }

  const free = rows.find(function (r) {
    return !norm(layout.values[r][layout.name]) && !norm(layout.values[r][layout.email]);
  });
  if (free !== undefined) {
    writeBooker(sheet, layout, free + 1, booking, BOOKED_BACKGROUND);
    return { status: "booked", rowWritten: free + 1, tabName: sheet.getName() };
  }

  // Slot missing from the tab, or already filled by someone else: add a row so nothing is lost
  const row1 = appendSlotRow(sheet, layout, booking);
  writeBooker(sheet, layout, row1, booking, rows.length ? CLASH_BACKGROUND : BOOKED_BACKGROUND);
  return {
    status: rows.length ? "clash row added" : "slot row added",
    rowWritten: row1,
    tabName: sheet.getName(),
  };
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = JSON.parse(raw);

    const expectedSecret = normalizeSecret(
      PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET")
    );
    const providedSecret = normalizeSecret(body.token);

    if (!constantTimeSecretMatch(providedSecret, expectedSecret)) {
      console.warn(
        "[WEBHOOK AUTH] unauthorized: expected(len=" +
          expectedSecret.length +
          ") provided(len=" +
          providedSecret.length +
          ")"
      );
      return jsonResponse({
        ok: false,
        status: 401,
        error: "unauthorized",
        cause: "secret mismatch or stale deployment",
        scriptVersion: SCRIPT_VERSION,
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Health checks used by the admin sheet-status panel
    if (body.action === "ping") {
      const firstTab = (body.tabName && ss.getSheetByName(body.tabName)) || findAdvisorSheet(ss, "silvia") || ss.getSheets()[0];
      return jsonResponse({
        ok: true,
        action: "ping",
        scriptVersion: SCRIPT_VERSION,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheetTabName: firstTab ? firstTab.getName() : (body.tabName || "1-on-1 Booking Tracker"),
        allTabs: ss.getSheets().map(function (s) { return s.getName(); }),
      });
    }

    if (body.action === "read_headers") {
      const tab = (body.tabName && ss.getSheetByName(body.tabName)) || findAdvisorSheet(ss, "silvia") || ss.getSheets()[0];
      const layout = readLayout(tab);
      return jsonResponse({
        ok: true,
        action: "read_headers",
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        tabName: tab.getName(),
        headers: layout ? layout.values[layout.headerRow] : [],
        slotRows: layout ? layout.values.slice(layout.headerRow + 1).map(function (r, idx) {
          return {
            rowIndex: layout.headerRow + idx + 2,
            date: String(r[layout.date] || "").trim(),
            time: String(r[layout.time] || "").trim(),
            status: layout.email !== -1 && String(r[layout.email] || "").trim() ? "booked" : "",
          };
        }) : [],
      });
    }

    if (body.action === "upsert") {
      if (!body.booking || !body.booking.id) return jsonResponse({ ok: false, error: "Missing booking payload" });
      const result = applyBooking(ss, body.booking);
      return jsonResponse({
        ok: true,
        action: "upsert",
        id: body.booking.id,
        result: result.status,
        rowWritten: result.rowWritten,
        tabName: result.tabName,
      });
    }

    if (body.action === "bulk") {
      const bookings = Array.isArray(body.bookings) ? body.bookings.slice(0, 50) : [];
      // Apply cancellations first so a slot that was cancelled and rebooked ends up showing the new booker
      bookings.sort(function (a, b) {
        return (norm(a.status) === "cancelled" ? 0 : 1) - (norm(b.status) === "cancelled" ? 0 : 1);
      });
      const errors = [];
      let count = 0;
      const results = [];
      bookings.forEach(function (booking) {
        try {
          const r = applyBooking(ss, booking);
          count++;
          results.push({ id: booking.id, status: r.status, rowWritten: r.rowWritten, tabName: r.tabName });
        } catch (err) {
          errors.push(String(booking && booking.id) + ": " + String(err && err.message ? err.message : err));
        }
      });
      if (errors.length) return jsonResponse({ ok: false, action: "bulk", count: count, error: errors.join("; ").slice(0, 500) });
      return jsonResponse({ ok: true, action: "bulk", count: count, results: results });
    }

    return jsonResponse({ ok: false, error: "Unsupported action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}
