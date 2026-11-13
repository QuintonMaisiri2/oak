/**
 * Google Apps Script Web App for Oak Foundation 1:1 Clinic Bookings
 * Paste into Extensions > Apps Script > Code.gs
 */

const SCRIPT_VERSION = "2026.11.04-v3";
const SHEET_TAB_NAME = "1-on-1 Booking Tracker";

const HEADERS = [
  "id",
  "status",
  "date",
  "time",
  "length",
  "advisor",
  "advisorEmail",
  "name",
  "email",
  "organisation",
  "message",
  "bookedAt",
  "cancelledAt",
  "emailStatus",
  "updatedAt"
];

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

/**
 * Constant-time comparison of two normalized secrets using SHA-256 digests.
 */
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
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// Formula-injection protection: prefix strings starting with =, +, -, or @ with an apostrophe
function sanitizeCell(value) {
  var str = String(value == null ? "" : value);
  if (/^[=+\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function getTargetSpreadsheet(overrideId) {
  var id = String(
    overrideId || PropertiesService.getScriptProperties().getProperty("SHEET_ID") || ""
  ).trim();
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function resolveTrackerSheet(ss, preferredTabName) {
  var candidates = [
    preferredTabName,
    SHEET_TAB_NAME,
    "Book time with Silvia"
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i]) {
      var found = ss.getSheetByName(candidates[i]);
      if (found) return found;
    }
  }
  var all = ss.getSheets();
  for (var j = 0; j < all.length; j++) {
    var sh = all[j];
    if (sh.getLastRow() >= 1) {
      var a1 = String(sh.getRange(1, 1).getValue() || "").trim().toLowerCase();
      if (a1 === "slot id" || a1 === "slot_id") {
        return sh;
      }
    }
  }
  return all[0] || null;
}

function getOrInitSheet(overrideId) {
  var ss = getTargetSpreadsheet(overrideId);
  var sheet = ss.getSheetByName("Bookings") || ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#f1f5f9");
  sheet.setFrozenRows(1);
  return sheet;
}

function bookingToRow(b) {
  return [
    sanitizeCell(b.id),
    sanitizeCell(b.status),
    sanitizeCell(b.date),
    sanitizeCell(b.time),
    Number(b.length || 0),
    sanitizeCell(b.advisor),
    sanitizeCell(b.advisorEmail),
    sanitizeCell(b.name),
    sanitizeCell(b.email),
    sanitizeCell(b.organisation),
    sanitizeCell(b.message),
    sanitizeCell(b.bookedAt),
    sanitizeCell(b.cancelledAt),
    sanitizeCell(b.emailStatus),
    new Date().toISOString()
  ];
}

function formatBookingRow(sheet, rowIndex, statusValue) {
  sheet.getRange(rowIndex, 3, 1, 2).setNumberFormat("@");
  var statusCell = sheet.getRange(rowIndex, 2);
  var normalized = String(statusValue || "").toLowerCase().trim();
  if (normalized === "confirmed") {
    statusCell.setBackground("#dcfce7").setFontColor("#166534").setFontWeight("bold");
  } else if (normalized === "cancelled") {
    statusCell.setBackground("#fee2e2").setFontColor("#991b1b").setFontWeight("bold");
  } else {
    statusCell.setBackground("#fef9c3").setFontColor("#854d0e").setFontWeight("bold");
  }
}

function finalizeSheetFormatting(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow >= 1) {
    var fullRange = sheet.getRange(1, 1, lastRow, HEADERS.length);
    var existingFilter = sheet.getFilter();
    if (existingFilter) {
      existingFilter.remove();
    }
    fullRange.createFilter();
    sheet.autoResizeColumns(1, HEADERS.length);
  }
}

/**
 * Write-back strictly by matching Slot ID in Column A (never by row number).
 * Only touches Columns I, J, K, L (cols 9..12) and Column O (col 15).
 * Never writes M, N, P, Q or R.
 */
function updateSlotRowBySlotId(booking, overrideSheetId) {
  if (!booking) return { matched: false, rowWritten: null };
  var ss = getTargetSpreadsheet(overrideSheetId);
  var candidateSheets = [];
  var primary = resolveTrackerSheet(ss, null);
  if (primary) candidateSheets.push(primary);
  var allSheets = ss.getSheets();
  for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
    if (!primary || allSheets[sIdx].getName() !== primary.getName()) {
      candidateSheets.push(allSheets[sIdx]);
    }
  }

  var slotId = String(booking.slotId || "").trim();
  var externalSlotId = String(booking.externalSlotId || "").trim();
  if (!slotId && !externalSlotId) {
    return { matched: false, rowWritten: null };
  }

  for (var c = 0; c < candidateSheets.length; c++) {
    var trackerSheet = candidateSheets[c];
    var lastRow = Math.max(trackerSheet.getLastRow(), 2);
    if (lastRow < 2) continue;
    var colA = trackerSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < colA.length; i++) {
      var cellId = String(colA[i][0] || "").trim();
      if (
        (slotId && cellId === slotId) ||
        (externalSlotId && cellId === externalSlotId)
      ) {
        var targetRow = i + 2;
        var isCancelled = String(booking.status || "").toLowerCase() === "cancelled";
        var cols = booking.columns || {
          I: isCancelled ? "" : booking.organisation || "",
          J: isCancelled ? "" : booking.name || "",
          K: isCancelled ? "" : booking.email || "",
          L: isCancelled ? "Available" : "Confirmed",
          O: isCancelled ? "" : booking.message || ""
        };
        // Only write Columns I, J, K, L (columns 9..12) and Column O (column 15)
        trackerSheet.getRange(targetRow, 9, 1, 4).setValues([[
          sanitizeCell(cols.I),
          sanitizeCell(cols.J),
          sanitizeCell(cols.K),
          sanitizeCell(cols.L)
        ]]);
        trackerSheet.getRange(targetRow, 15, 1, 1).setValues([[sanitizeCell(cols.O)]]);
        return {
          matched: true,
          rowWritten: targetRow,
          slotId: cellId,
          tabName: trackerSheet.getName()
        };
      }
    }
  }

  return { matched: false, rowWritten: null };
}

function upsertBookingRow(sheet, idToRowMap, booking, overrideSheetId) {
  if (!booking || !booking.id) return { ok: false, rowWritten: null };
  var slotMatch = updateSlotRowBySlotId(booking, overrideSheetId);
  var id = String(booking.id);
  var rowValues = bookingToRow(booking);
  var targetRowIndex = idToRowMap.get(id);

  // Only write the flat Bookings row if the sheet is a dedicated "Bookings" log tab (not the 1-on-1 slot tracker)
  var a1Header = String(sheet.getRange(1, 1).getValue() || "").trim().toLowerCase();
  if (a1Header === "id" || sheet.getName() === "Bookings") {
    if (targetRowIndex) {
      sheet.getRange(targetRowIndex, 3, 1, 2).setNumberFormat("@");
      sheet.getRange(targetRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      targetRowIndex = sheet.getLastRow() + 1;
      sheet.getRange(targetRowIndex, 3, 1, 2).setNumberFormat("@");
      sheet.getRange(targetRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      idToRowMap.set(id, targetRowIndex);
    }
    formatBookingRow(sheet, targetRowIndex, booking.status);
  }

  return {
    ok: true,
    rowWritten: slotMatch.rowWritten || targetRowIndex || null,
    slotMatched: slotMatch.matched,
    tabName: slotMatch.tabName || sheet.getName()
  };
}

function buildIdIndex(sheet) {
  var map = new Map();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return map;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0] || "").trim();
    if (id) {
      map.set(id, i + 2);
    }
  }
  return map;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Apps Script cannot read HTTP request headers in doPost; read secret from the JSON body
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var body = JSON.parse(raw);

    var expectedSecret = normalizeSecret(
      PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET")
    );
    var providedSecret = normalizeSecret(body.token);

    if (!constantTimeSecretMatch(providedSecret, expectedSecret)) {
      // Log ONLY the secret's length, never its value
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
        scriptVersion: SCRIPT_VERSION
      });
    }

    var action = body.action;

    if (action === "ping") {
      var ss = getTargetSpreadsheet(body.sheetId);
      var s = resolveTrackerSheet(ss, body.tabName);
      return jsonResponse({
        ok: true,
        action: "ping",
        scriptVersion: SCRIPT_VERSION,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheetTabName: s ? s.getName() : SHEET_TAB_NAME,
        allTabs: ss.getSheets().map(function(sh) { return sh.getName(); })
      });
    }

    if (action === "read_headers") {
      var ss2 = getTargetSpreadsheet(body.sheetId);
      var s2 = resolveTrackerSheet(ss2, body.tabName);
      var lastRow = Math.max(s2.getLastRow(), 1);
      var lastCol = Math.max(s2.getLastColumn(), 15);
      var values = s2.getRange(1, 1, Math.min(lastRow, 50), lastCol).getDisplayValues();
      var headers = (values[0] || []).map(String);
      var slotRows = values.slice(1).map(function(r, idx) {
        return {
          rowIndex: idx + 2,
          slotId: String(r[0] || "").trim(),
          date: String(r[1] || "").trim(),
          time: String(r[2] || "").trim(),
          status: String(r[11] || "").trim()
        };
      });
      return jsonResponse({
        ok: true,
        action: "read_headers",
        spreadsheetId: ss2.getId(),
        spreadsheetName: ss2.getName(),
        tabName: s2.getName(),
        sheetTabName: s2.getName(),
        headers: headers,
        slotRows: slotRows
      });
    }

    var sheet = getOrInitSheet(body.sheetId);
    var idToRowMap = buildIdIndex(sheet);

    if (action === "upsert") {
      if (!body.booking || !body.booking.id) {
        return jsonResponse({ ok: false, error: "Missing booking payload" });
      }
      var upsertRes = upsertBookingRow(sheet, idToRowMap, body.booking, body.sheetId);
      return jsonResponse({
        ok: true,
        action: "upsert",
        id: body.booking.id,
        rowWritten: upsertRes.rowWritten,
        slotMatched: upsertRes.slotMatched,
        tabName: upsertRes.tabName
      });
    }

    if (action === "bulk") {
      var bookings = Array.isArray(body.bookings) ? body.bookings.slice(0, 50) : [];
      var count = 0;
      var results = [];
      for (var i = 0; i < bookings.length; i++) {
        var r = upsertBookingRow(sheet, idToRowMap, bookings[i], body.sheetId);
        if (r && r.ok) {
          count++;
          results.push({
            id: bookings[i].id,
            slotId: bookings[i].externalSlotId || bookings[i].slotId,
            rowWritten: r.rowWritten,
            slotMatched: r.slotMatched
          });
        }
      }
      return jsonResponse({ ok: true, action: "bulk", count: count, results: results });
    }

    return jsonResponse({ ok: false, error: "Unsupported action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}
