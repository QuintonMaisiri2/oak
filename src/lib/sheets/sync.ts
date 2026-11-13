import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { recordErrorLog, resolveErrorLogs } from "@/lib/error-log";

const EVENT_TIMEZONE = "Africa/Harare";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2; // Initial attempt + up to 2 immediate retries on 5xx/timeout = 3 attempts max per call
const BULK_BATCH_SIZE = 50;
const DEFAULT_SPREADSHEET_ID = "1qKaOFXnL3vhr9YUwCwkzaWVf2k2ZgFB8L83EsjVMm5c";
const DEFAULT_SHEET_TAB_NAME = "1-on-1 Booking Tracker";

export type SheetSyncStatus = "pending" | "synced" | "failed";

export interface SheetRowColumnValues {
  I: string; // Grantee Organization
  J: string; // Grantee Contact Name
  K: string; // Grantee Contact Email
  L: string; // Booking Status ("Confirmed" | "Available")
  O: string; // Pre-Session Discussion Objectives / Message
}

export interface SheetBookingPayload {
  id: string;
  slotId?: string;
  externalSlotId?: string;
  sheetRowIndex?: number;
  columns?: SheetRowColumnValues;
  status: "confirmed" | "cancelled";
  date: string;
  time: string;
  length: number;
  advisor: string;
  advisorEmail: string;
  name: string;
  email: string;
  organisation: string;
  message: string;
  bookedAt: string;
  cancelledAt: string;
  emailStatus: string;
}

export interface SheetSyncState {
  sheet_sync_status: SheetSyncStatus;
  sheet_sync_error: string | null;
  sheet_synced_at: string | null;
  cancelled_at?: string | null;
  sheet_row_index?: number | null;
  attempts?: number;
}

export interface SheetSyncQueueItem {
  id: string;
  booking_id: string;
  slot_id: string | null;
  sheet_row_index: number | null;
  action: "upsert";
  status: "pending" | "processing" | "synced" | "failed";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_retry_at: string;
  payload: SheetBookingPayload;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SheetWebhookConfigStatus {
  hasUrl: boolean;
  hasSecret: boolean;
  isConfigured: boolean;
  urlEndsWithExec: boolean;
  urlEndsWithDev: boolean;
  isNotPlaceholder: boolean;
  secretLength?: number;
  sheetsApiConfigured?: boolean;
  spreadsheetId?: string;
  tabName?: string;
}

export interface SheetWebhookCallResult {
  ok: boolean;
  status: number;
  error: string | null;
  unauthorized?: boolean;
  cause?: string;
  data?: Record<string, any>;
}

const memorySyncStore = new Map<string, SheetSyncState>();

function getSyncStateFilePath(): string {
  return process.env.OAK_SYNC_STATE_FILE || path.join(os.tmpdir(), "oak-sheet-sync-state.json");
}

function getSyncQueueFilePath(): string {
  return process.env.OAK_SYNC_QUEUE_FILE || path.join(os.tmpdir(), "oak-sheet-sync-queue.json");
}

function loadFallbackStoreFromDisk(): void {
  try {
    const filePath = getSyncStateFilePath();
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object") {
            memorySyncStore.set(k, v as SheetSyncState);
          }
        }
      }
    }
  } catch {
    // Ignore disk cache read errors
  }
}

function saveFallbackStoreToDisk(): void {
  try {
    const filePath = getSyncStateFilePath();
    const obj: Record<string, SheetSyncState> = {};
    for (const [k, v] of memorySyncStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(/*turbopackIgnore: true*/ filePath, JSON.stringify(obj), "utf8");
  } catch {
    // Ignore disk cache write errors
  }
}

export function getMemorySyncState(bookingId: string): SheetSyncState | undefined {
  if (!memorySyncStore.has(bookingId)) {
    loadFallbackStoreFromDisk();
  }
  return memorySyncStore.get(bookingId);
}

export function recordMemoryCancelledAt(bookingId: string, cancelledAtIso: string): void {
  loadFallbackStoreFromDisk();
  const existing = memorySyncStore.get(bookingId) || {
    sheet_sync_status: "pending",
    sheet_sync_error: null,
    sheet_synced_at: null,
  };
  memorySyncStore.set(bookingId, {
    ...existing,
    cancelled_at: cancelledAtIso,
  });
  saveFallbackStoreToDisk();
}

/**
 * Checks whether direct Google Sheets API v4 write-back is configured.
 */
export function isGoogleSheetsApiConfigured(): boolean {
  if (process.env.GOOGLE_SHEETS_API_BASE_URL) return true;
  if (
    process.env.GCP_WORKLOAD_IDENTITY_PROVIDER &&
    (process.env.GCP_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT)
  ) {
    return true;
  }
  if (
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    return true;
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return true;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
  if (process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT && !process.env.VERCEL) return true;
  return false;
}

/**
 * Normalizes a webhook secret by stripping leading/trailing whitespace, carriage returns,
 * newlines (\r, \n, and literal escaped \r/\n), and surrounding quotes.
 */
export function normalizeWebhookSecret(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw).replace(/[\r\n]+/g, "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).replace(/[\r\n]+/g, "").trim();
  }
  s = s.replace(/\\r|\\n/g, "").trim();
  return s;
}

/**
 * Compares two secrets in constant time using SHA-256 digests after trimming whitespace and newlines.
 */
export function constantTimeEqualSecrets(a?: string | null, b?: string | null): boolean {
  const cleanA = normalizeWebhookSecret(a);
  const cleanB = normalizeWebhookSecret(b);
  if (!cleanA || !cleanB) return false;
  const digestA = crypto.createHash("sha256").update(cleanA, "utf8").digest();
  const digestB = crypto.createHash("sha256").update(cleanB, "utf8").digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

/**
 * Returns a safe, non-sensitive diagnostic fingerprint of the secret:
 * ONLY its character length (never its value).
 */
export function getSecretSafeFingerprint(raw?: string | null): {
  length: number;
} {
  const clean = normalizeWebhookSecret(raw);
  return {
    length: clean.length,
  };
}

/**
 * Checks whether SHEETS_WEBHOOK_URL and SHEETS_WEBHOOK_SECRET are set and valid.
 * Returns boolean flags and safe secret length only — never exposes the actual URL or secret.
 */
export function getSheetWebhookConfigStatus(): SheetWebhookConfigStatus {
  const rawUrl = (process.env.SHEETS_WEBHOOK_URL || "").replace(/[\r\n]+/g, "").trim();
  const cleanSecret = normalizeWebhookSecret(process.env.SHEETS_WEBHOOK_SECRET);
  const fp = getSecretSafeFingerprint(cleanSecret);
  const hasUrl = Boolean(rawUrl);
  const hasSecret = Boolean(cleanSecret);
  const urlEndsWithDev = hasUrl && /\/dev(?:\?.*)?$/i.test(rawUrl);
  const urlEndsWithExec = hasUrl && /\/exec(?:\?.*)?$/i.test(rawUrl) && !urlEndsWithDev;
  const isNotPlaceholder =
    hasUrl &&
    hasSecret &&
    !/YOUR_DEPLOYMENT_ID|placeholder|your_webhook_secret|example\.com/i.test(rawUrl) &&
    !/placeholder|your_webhook_secret|changeme/i.test(cleanSecret);
  const sheetsApiConfigured = isGoogleSheetsApiConfigured();

  return {
    hasUrl,
    hasSecret,
    isConfigured: (hasUrl && hasSecret && isNotPlaceholder) || sheetsApiConfigured,
    urlEndsWithExec,
    urlEndsWithDev,
    isNotPlaceholder,
    secretLength: fp.length,
    sheetsApiConfigured,
    spreadsheetId: process.env.SHEET_ID || process.env.GOOGLE_SHEET_ID || DEFAULT_SPREADSHEET_ID,
    tabName: process.env.GOOGLE_SHEET_TAB_NAME || DEFAULT_SHEET_TAB_NAME,
  };
}

/**
 * Scrubs any accidental occurrence of the webhook URL, secret, or Google script URLs
 * from error messages before they are stored or returned.
 */
export function sanitizeSheetError(rawError: unknown): string {
  let msg =
    rawError instanceof Error
      ? rawError.message
      : typeof rawError === "string"
      ? rawError
      : "Sheet sync failed";

  const rawUrl = (process.env.SHEETS_WEBHOOK_URL || "").trim();
  const rawSecret = (process.env.SHEETS_WEBHOOK_SECRET || "").trim();

  if (rawUrl && msg.includes(rawUrl)) {
    msg = msg.split(rawUrl).join("[REDACTED_WEBHOOK_URL]");
  }
  if (rawSecret && msg.includes(rawSecret)) {
    msg = msg.split(rawSecret).join("[REDACTED_SECRET]");
  }

  msg = msg.replace(/https?:\/\/script\.google(?:usercontent)?\.com\/[^\s"'<>]+/gi, "[WEBHOOK_URL]");

  return msg.trim().slice(0, 500) || "Sheet sync failed";
}

/**
 * Formats slot start/end timestamps into readable date and time strings in the event timezone (Africa/Harare).
 */
export function formatEventDateAndTime(
  startTimeIso?: string | null,
  endTimeIso?: string | null
): { date: string; time: string } {
  if (!startTimeIso) {
    return { date: "", time: "" };
  }

  const startDate = new Date(startTimeIso);
  if (Number.isNaN(startDate.getTime())) {
    return { date: String(startTimeIso), time: "" };
  }

  const date = startDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIMEZONE,
  });

  const startTimeFormatted = startDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIMEZONE,
  });

  if (!endTimeIso) {
    return { date, time: startTimeFormatted };
  }

  const endDate = new Date(endTimeIso);
  if (Number.isNaN(endDate.getTime())) {
    return { date, time: startTimeFormatted };
  }

  const endTimeFormatted = endDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIMEZONE,
  });

  return {
    date,
    time: `${startTimeFormatted} - ${endTimeFormatted}`,
  };
}

/**
 * Resolves the target 1-based Google Sheet row index (Row 2..N, since Row 1 is headers)
 * and external Slot ID (e.g. OAK-SESS-101..108) for a slot.
 */
export async function resolveSlotSheetTarget(
  adminClient: any,
  slot: any
): Promise<{
  slotId: string;
  externalSlotId: string;
  sheetRowIndex: number;
}> {
  const slotId = String(slot?.id || "");
  if (slot?.sheet_row_index && Number(slot.sheet_row_index) >= 2) {
    const rowIdx = Number(slot.sheet_row_index);
    return {
      slotId,
      externalSlotId: String(slot.external_slot_id || `OAK-SESS-${100 + rowIdx - 1}`),
      sheetRowIndex: rowIdx,
    };
  }

  if (adminClient && slotId) {
    try {
      let query = adminClient
        .from("slots")
        .select("id, start_time, advisor_id")
        .order("start_time", { ascending: true })
        .order("id", { ascending: true });

      if (slot?.advisor_id) {
        query = query.eq("advisor_id", slot.advisor_id);
      }

      const { data: allSlots } = await query;
      if (Array.isArray(allSlots) && allSlots.length > 0) {
        const idx = allSlots.findIndex((s: any) => s.id === slotId);
        if (idx >= 0) {
          const seq = idx + 1;
          return {
            slotId,
            externalSlotId: String(slot?.external_slot_id || `OAK-SESS-${100 + seq}`),
            sheetRowIndex: seq + 1, // Row 1 is header -> Slot #1 is Row 2
          };
        }
      }
    } catch {
      // Fallback to default row 2 if query fails
    }
  }

  return {
    slotId,
    externalSlotId: String(slot?.external_slot_id || "OAK-SESS-101"),
    sheetRowIndex: Number(slot?.sheet_row_index || 2),
  };
}

/**
 * Builds the exact values for Columns I, J, K, L, O of the slot's row in "Book time with Silvia".
 * - Column I: Grantee Organization
 * - Column J: Grantee Lead Contact / Booker Name
 * - Column K: Grantee Contact Email
 * - Column L: Booking Status ("Confirmed" or "Available")
 * - Column O: Pre-Session Discussion Objectives / Message
 */
export function buildSheetRowColumns(booking: {
  status?: string;
  organisation?: string;
  name?: string;
  email?: string;
  message?: string;
}): SheetRowColumnValues {
  const isCancelled = booking?.status === "cancelled";
  if (isCancelled) {
    return {
      I: "",
      J: "",
      K: "",
      L: "Available",
      O: "",
    };
  }
  return {
    I: String(booking?.organisation || ""),
    J: String(booking?.name || ""),
    K: String(booking?.email || ""),
    L: "Confirmed",
    O: String(booking?.message || ""),
  };
}

/**
 * Converts a database booking record (with joined slot & advisor) into the exact
 * webhook & sheet booking payload.
 */
export function buildSheetBookingPayload(
  booking: any,
  slotTarget?: { slotId?: string; externalSlotId?: string; sheetRowIndex?: number }
): SheetBookingPayload {
  const slot = Array.isArray(booking?.slots) ? booking.slots[0] : booking?.slots;
  const advisor = slot?.advisors
    ? Array.isArray(slot.advisors)
      ? slot.advisors[0]
      : slot.advisors
    : booking?.advisor || null;

  const { date, time } = formatEventDateAndTime(slot?.start_time, slot?.end_time);
  const status: "confirmed" | "cancelled" =
    booking?.status === "cancelled" ? "cancelled" : "confirmed";

  const memState = booking?.id ? getMemorySyncState(booking.id) : undefined;
  const rawCancelledAt = booking?.cancelled_at || memState?.cancelled_at || null;

  let cancelledAt = "";
  if (status === "cancelled") {
    if (rawCancelledAt) {
      const parsed = new Date(rawCancelledAt);
      cancelledAt = Number.isNaN(parsed.getTime()) ? String(rawCancelledAt) : parsed.toISOString();
    } else {
      cancelledAt = new Date().toISOString();
    }
  }

  let bookedAt = "";
  if (booking?.created_at) {
    const parsed = new Date(booking.created_at);
    bookedAt = Number.isNaN(parsed.getTime()) ? String(booking.created_at) : parsed.toISOString();
  } else {
    bookedAt = new Date().toISOString();
  }

  const slotId = String(slotTarget?.slotId || slot?.id || booking?.slot_id || "");
  const sheetRowIndex =
    slotTarget?.sheetRowIndex ??
    (slot?.sheet_row_index ? Number(slot.sheet_row_index) : undefined);
  const externalSlotId =
    slotTarget?.externalSlotId ||
    slot?.external_slot_id ||
    (sheetRowIndex ? `OAK-SESS-${100 + sheetRowIndex - 1}` : undefined);

  const columns = buildSheetRowColumns({
    status,
    organisation: booking?.organisation,
    name: booking?.name,
    email: booking?.email,
    message: booking?.message,
  });

  return {
    id: String(booking?.id || ""),
    slotId,
    externalSlotId,
    sheetRowIndex,
    columns,
    status,
    date: booking?.date_formatted || date,
    time: booking?.time_formatted || time,
    length: Number(slot?.duration_minutes ?? booking?.duration_minutes ?? 30),
    advisor: String(advisor?.full_name || booking?.advisor_name || "Silvia Guizzardi"),
    advisorEmail: String(advisor?.email || booking?.advisor_email || "silvia.guizzardi@oakfnd.ch"),
    name: String(booking?.name || ""),
    email: String(booking?.email || ""),
    organisation: String(booking?.organisation || ""),
    message: String(booking?.message || ""),
    bookedAt,
    cancelledAt,
    emailStatus: String(booking?.email_status || "pending"),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Updates Columns I, J, K, L, O of the booked slot's row in the Google Sheet using the
 * Google Sheets v4 API (`spreadsheets.values.batchUpdate`).
 * Looks up the target row by matching Column A (`Slot ID`: UUID or `OAK-SESS-10x`) or
 * matching Date+Time, falling back to `payload.sheetRowIndex` (Row 2..N).
 */
export async function writeBookingRowViaSheetsApi(
  payload: SheetBookingPayload,
  options?: { fetchImpl?: typeof fetch }
): Promise<SheetWebhookCallResult> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || DEFAULT_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || DEFAULT_SHEET_TAB_NAME;
  const cols =
    payload.columns ||
    buildSheetRowColumns({
      status: payload.status,
      organisation: payload.organisation,
      name: payload.name,
      email: payload.email,
      message: payload.message,
    });

  // Support custom base URL for local/automated integration testing of the v4 Sheets API
  const customBaseUrl = (process.env.GOOGLE_SHEETS_API_BASE_URL || "").trim();
  const fetchFn = options?.fetchImpl || globalThis.fetch;

  if (customBaseUrl) {
    try {
      const readUrl = `${customBaseUrl.replace(/\/$/, "")}/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(`'${tabName}'!A1:P50`)}`;
      const readRes = await fetchFn(readUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!readRes.ok) {
        const errTxt = await readRes.text();
        return {
          ok: false,
          status: readRes.status,
          error: sanitizeSheetError(`Sheets API read failed (HTTP ${readRes.status}): ${errTxt}`),
        };
      }
      const readData = await readRes.json();
      const rows: string[][] = Array.isArray(readData?.values) ? readData.values : [];

      let targetRow = payload.sheetRowIndex || 2;
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const cellSlotId = String(row[0] || "").trim();
        if (
          (payload.slotId && cellSlotId === payload.slotId) ||
          (payload.externalSlotId && cellSlotId === payload.externalSlotId)
        ) {
          targetRow = r + 1;
          break;
        }
      }

      const batchUrl = `${customBaseUrl.replace(/\/$/, "")}/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`;
      const batchRes = await fetchFn(batchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: [
            {
              range: `'${tabName}'!I${targetRow}:L${targetRow}`,
              values: [[cols.I, cols.J, cols.K, cols.L]],
            },
            {
              range: `'${tabName}'!O${targetRow}`,
              values: [[cols.O]],
            },
          ],
        }),
      });

      if (!batchRes.ok) {
        const errTxt = await batchRes.text();
        return {
          ok: false,
          status: batchRes.status,
          error: sanitizeSheetError(
            `Sheets API batchUpdate failed (HTTP ${batchRes.status}): ${errTxt}`
          ),
        };
      }

      const batchData = await batchRes.json();
      return {
        ok: true,
        status: 200,
        error: null,
        data: { ...batchData, updatedRow: targetRow },
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: sanitizeSheetError(err),
      };
    }
  }

  // Support Keyless Workload Identity Federation (Vercel OIDC -> Google STS -> IAM Credentials)
  if (
    process.env.GCP_WORKLOAD_IDENTITY_PROVIDER &&
    (process.env.GCP_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT)
  ) {
    try {
      const { exchangeVercelOidcForGoogleAccessToken } = await import("@/lib/sheets/auth");
      const accessToken = await exchangeVercelOidcForGoogleAccessToken();
      const rangeParam = encodeURIComponent(`'${tabName}'!A1:P50`);
      const readRes = await fetchFn(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}/values/${rangeParam}?valueRenderOption=FORMATTED_VALUE`,
        {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        }
      );

      if (!readRes.ok) {
        const errTxt = await readRes.text();
        return {
          ok: false,
          status: readRes.status,
          error: sanitizeSheetError(`WIF Sheets API read failed (HTTP ${readRes.status}): ${errTxt}`),
        };
      }

      const readData = await readRes.json();
      const rows: string[][] = Array.isArray(readData?.values) ? readData.values : [];
      let targetRow = payload.sheetRowIndex || 2;
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const cellSlotId = String(row[0] || "").trim();
        if (
          (payload.slotId && cellSlotId === payload.slotId) ||
          (payload.externalSlotId && cellSlotId === payload.externalSlotId)
        ) {
          targetRow = r + 1;
          break;
        }
      }

      const batchRes = await fetchFn(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: [
              {
                range: `'${tabName}'!I${targetRow}:L${targetRow}`,
                values: [[cols.I, cols.J, cols.K, cols.L]],
              },
              {
                range: `'${tabName}'!O${targetRow}`,
                values: [[cols.O]],
              },
            ],
          }),
        }
      );

      if (!batchRes.ok) {
        const errTxt = await batchRes.text();
        return {
          ok: false,
          status: batchRes.status,
          error: sanitizeSheetError(
            `WIF Sheets API batchUpdate failed (HTTP ${batchRes.status}): ${errTxt}`
          ),
        };
      }

      const batchData = await batchRes.json();
      return {
        ok: true,
        status: 200,
        error: null,
        data: { ...batchData, updatedRow: targetRow },
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: sanitizeSheetError(err),
      };
    }
  }

  try {
    const { google } = await import("googleapis");
    const authOptions: Record<string, any> = {
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    };

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      authOptions.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else if (
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ) {
      authOptions.credentials = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };
    }

    const auth = new google.auth.GoogleAuth(authOptions);
    const sheets = google.sheets({ version: "v4", auth });

    // 1. Read header row + Slot ID column to locate the exact row for this slot
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A1:P50`,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = readRes.data.values || [];
    let targetRow = payload.sheetRowIndex || 2;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const cellSlotId = String(row[0] || "").trim();
      if (
        (payload.slotId && cellSlotId === payload.slotId) ||
        (payload.externalSlotId && cellSlotId === payload.externalSlotId)
      ) {
        targetRow = r + 1;
        break;
      }
    }

    // 2. Write booking details to Columns I, J, K, L and O of targetRow
    const writeRes = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `'${tabName}'!I${targetRow}:L${targetRow}`,
            values: [[cols.I, cols.J, cols.K, cols.L]],
          },
          {
            range: `'${tabName}'!O${targetRow}`,
            values: [[cols.O]],
          },
        ],
      },
    });

    return {
      ok: true,
      status: writeRes.status || 200,
      error: null,
      data: {
        updatedRow: targetRow,
        totalUpdatedCells: writeRes.data?.totalUpdatedCells ?? 5,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      status: Number(err?.code) || 0,
      error: sanitizeSheetError(err),
    };
  }
}

/**
 * Performs a single HTTP POST to the Apps Script webhook, following 301/302/303/307/308
 * redirects and enforcing a timeout.
 */
async function postOnceWithRedirects(
  webhookUrl: string,
  payloadJson: string,
  timeoutMs: number,
  customFetch?: typeof fetch
): Promise<Response> {
  const fetchFn = customFetch || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("Request timed out after 10s")),
    timeoutMs
  );

  try {
    let currentUrl = webhookUrl;
    let method: "POST" | "GET" = "POST";
    let body: string | undefined = payloadJson;
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    for (let hop = 0; hop < 6; hop++) {
      const res = await fetchFn(currentUrl, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) {
          return res;
        }
        currentUrl = new URL(location, currentUrl).toString();
        if (res.status === 301 || res.status === 302 || res.status === 303) {
          method = "GET";
          body = undefined;
          headers = { Accept: "application/json" };
        }
        continue;
      }

      return res;
    }

    throw new Error("Too many redirects from webhook endpoint");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Posts an action payload to SHEETS_WEBHOOK_URL with automatic retries on timeouts
 * and 5xx errors (up to 2 retries). Never retries on "unauthorized".
 * Treats the call as successful ONLY if the JSON response has `ok: true`.
 */
export async function postToSheetsWebhook(
  bodyWithoutToken:
    | { action: "upsert"; booking: SheetBookingPayload }
    | { action: "bulk"; bookings: SheetBookingPayload[] }
    | { action: "ping"; tabName?: string }
    | { action: "read_headers"; tabName?: string }
    | { action: "test" },
  options?: {
    timeoutMs?: number;
    retryDelayMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<SheetWebhookCallResult> {
  const config = getSheetWebhookConfigStatus();
  const hasWebhook = config.hasUrl && config.hasSecret && config.isNotPlaceholder;

  if (!hasWebhook) {
    // If direct Google Sheets API v4 is configured and webhook isn't, route via Sheets API v4
    if (config.sheetsApiConfigured) {
      if (bodyWithoutToken.action === "upsert") {
        return writeBookingRowViaSheetsApi(bodyWithoutToken.booking, options);
      }
      if (bodyWithoutToken.action === "bulk") {
        for (const b of bodyWithoutToken.bookings) {
          const r = await writeBookingRowViaSheetsApi(b, options);
          if (!r.ok) return r;
        }
        return { ok: true, status: 200, error: null, data: { ok: true } };
      }
      return { ok: true, status: 200, error: null, data: { ok: true } };
    }

    const missing: string[] = [];
    if (!config.hasUrl) missing.push("SHEETS_WEBHOOK_URL");
    if (!config.hasSecret) missing.push("SHEETS_WEBHOOK_SECRET");
    if (config.hasUrl && config.hasSecret && !config.isNotPlaceholder) {
      return {
        ok: false,
        status: 0,
        error: "Google Sheets webhook environment variables still contain placeholder values.",
      };
    }
    return {
      ok: false,
      status: 0,
      error: `Google Sheets webhook is not configured (missing ${missing.join(" and ")}).`,
    };
  }

  const webhookUrl = (process.env.SHEETS_WEBHOOK_URL || "").replace(/[\r\n]+/g, "").trim();
  const secret = normalizeWebhookSecret(process.env.SHEETS_WEBHOOK_SECRET);
  const fp = getSecretSafeFingerprint(secret);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseDelayMs = options?.retryDelayMs ?? 350;

  // Log ONLY secret length, never its value or URL
  console.log(
    `[SHEETS WEBHOOK] action=${bodyWithoutToken.action} secret(length=${fp.length}) urlEndsWithExec=${config.urlEndsWithExec}`
  );

  // Apps Script cannot read HTTP headers in doPost; send trimmed secret in the JSON body as "token"
  const fullPayload = JSON.stringify({
    token: secret,
    ...bodyWithoutToken,
  });

  const recordUnauthorizedErrorLog = async (detailMsg: string) => {
    await recordErrorLog({
      source: "sheets_webhook_auth",
      severity: "critical",
      message: `Google Sheets Webhook 401 Unauthorized: secret mismatch or stale deployment (${detailMsg})`,
      details: {
        cause: "secret mismatch or stale deployment",
        status: 401,
        action: bodyWithoutToken.action,
        secret_length: fp.length,
        url_ends_with_exec: config.urlEndsWithExec,
      },
    });
  };

  let lastError = "Sheet sync failed";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(baseDelayMs * attempt);
    }

    try {
      const res = await postOnceWithRedirects(
        webhookUrl,
        fullPayload,
        timeoutMs,
        options?.fetchImpl
      );
      lastStatus = res.status;

      const rawText = await res.text();
      const trimmed = (rawText || "").trim();

      if (res.status === 401 || res.status === 403) {
        const unauthMsg =
          "Unauthorized (401): secret mismatch or stale deployment. Check that SHEETS_WEBHOOK_SECRET matches the Script Property WEBHOOK_SECRET and that a New Version of the Web App was deployed.";
        await recordUnauthorizedErrorLog(`HTTP ${res.status}`);
        return {
          ok: false,
          status: 401,
          unauthorized: true,
          cause: "secret mismatch or stale deployment",
          error: unauthMsg,
        };
      }

      if (res.status >= 500) {
        lastError = `Webhook server error (HTTP ${res.status}).`;
        continue;
      }

      let parsed: any = null;
      try {
        parsed = trimmed ? JSON.parse(trimmed) : null;
      } catch {
        const isHtml = /^<!doctype html>|^<html/i.test(trimmed);
        const devHint = config.urlEndsWithDev
          ? " The configured URL ends in /dev instead of /exec."
          : "";
        const htmlMsg = isHtml
          ? `Webhook returned an HTML page instead of JSON (HTTP ${res.status}).${devHint} Ensure the Apps Script Web App is deployed with 'Execute as: Me', 'Who has access: Anyone', and the URL ends in /exec.`
          : `Webhook returned invalid JSON (HTTP ${res.status}).${devHint}`;

        return {
          ok: false,
          status: res.status,
          error: sanitizeSheetError(htmlMsg),
        };
      }

      if (parsed && parsed.ok === true) {
        // If direct Sheets API v4 is also configured, update the slot row columns I, J, K, L, O too
        if (config.sheetsApiConfigured && bodyWithoutToken.action === "upsert") {
          await writeBookingRowViaSheetsApi(bodyWithoutToken.booking, options);
        }
        return {
          ok: true,
          status: res.status,
          error: null,
          data: parsed,
        };
      }

      const remoteError = sanitizeSheetError(
        parsed?.error || parsed?.message || `Webhook returned ok: false (HTTP ${res.status})`
      );

      if (
        parsed?.status === 401 ||
        /unauthori[sz]ed|invalid[_\s-]*token|forbidden|invalid[_\s-]*secret|secret mismatch/i.test(
          remoteError
        )
      ) {
        // If webhook secret is unauthorized, but direct Sheets API v4 IS configured, try direct Sheets API v4
        if (config.sheetsApiConfigured && bodyWithoutToken.action === "upsert") {
          const directRes = await writeBookingRowViaSheetsApi(bodyWithoutToken.booking, options);
          if (directRes.ok) {
            return directRes;
          }
        }
        await recordUnauthorizedErrorLog(remoteError);
        return {
          ok: false,
          status: 401,
          unauthorized: true,
          cause: "secret mismatch or stale deployment",
          error: `Unauthorized (401): secret mismatch or stale deployment. Check that SHEETS_WEBHOOK_SECRET matches the Script Property WEBHOOK_SECRET and that a New Version of the Web App was deployed.`,
          data: parsed || undefined,
        };
      }

      return {
        ok: false,
        status: res.status,
        error: remoteError,
        data: parsed || undefined,
      };
    } catch (err: any) {
      const isAbort =
        err?.name === "AbortError" ||
        err?.name === "TimeoutError" ||
        /timed?\s*out|abort/i.test(String(err?.message || ""));
      lastError = isAbort
        ? "Webhook request timed out after 10 seconds."
        : sanitizeSheetError(err);
    }
  }

  return {
    ok: false,
    status: lastStatus,
    error: sanitizeSheetError(lastError),
  };
}

// ============================================================================
// Persistent Queue (sheet_sync_queue) with Exponential Backoff
// ============================================================================

function readLocalQueue(): Record<string, SheetSyncQueueItem> {
  try {
    const filePath = getSyncQueueFilePath();
    if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) return {};
    const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalQueue(queueMap: Record<string, SheetSyncQueueItem>): void {
  try {
    const filePath = getSyncQueueFilePath();
    fs.writeFileSync(/*turbopackIgnore: true*/ filePath, JSON.stringify(queueMap, null, 2), "utf8");
  } catch {
    // Ignore local queue write errors
  }
}

/**
 * Computes exponential backoff timestamp:
 * attempt 1 -> +1m, attempt 2 -> +2m, attempt 3 -> +4m, attempt 4 -> +8m, attempt 5+ -> +15m
 */
export function computeNextRetryIso(attempts: number, baseBackoffMs = 60_000): string {
  const exp = Math.max(0, Math.min(attempts - 1, 4));
  const delayMs = Math.min(baseBackoffMs * Math.pow(2, exp), 15 * 60_000);
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Upserts an item in the persistent sheet_sync_queue.
 * Writes to public.sheet_sync_queue if migrated, and falls back to public.audit_log
 * in Supabase Postgres so queue state is 100% durable across Vercel serverless invocations.
 */
export async function upsertSheetSyncQueueItem(
  adminClient: any,
  params: {
    bookingId: string;
    slotId: string | null;
    sheetRowIndex: number | null;
    status: "pending" | "processing" | "synced" | "failed";
    attemptsDelta?: number;
    setAttempts?: number;
    lastError: string | null;
    payload: SheetBookingPayload;
    baseBackoffMs?: number;
  }
): Promise<SheetSyncQueueItem> {
  const nowIso = new Date().toISOString();
  const localMap = readLocalQueue();
  const existing = localMap[params.bookingId];

  const attempts =
    params.setAttempts !== undefined
      ? params.setAttempts
      : (existing?.attempts || 0) + (params.attemptsDelta ?? 1);

  const nextRetryAt =
    params.status === "synced"
      ? nowIso
      : computeNextRetryIso(attempts, params.baseBackoffMs ?? 60_000);

  const item: SheetSyncQueueItem = {
    id:
      existing?.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    booking_id: params.bookingId,
    slot_id: params.slotId || existing?.slot_id || null,
    sheet_row_index: params.sheetRowIndex ?? existing?.sheet_row_index ?? null,
    action: "upsert",
    status: params.status,
    attempts,
    max_attempts: existing?.max_attempts || 10,
    last_error: params.status === "synced" ? null : sanitizeSheetError(params.lastError),
    next_retry_at: nextRetryAt,
    payload: params.payload,
    synced_at: params.status === "synced" ? nowIso : existing?.synced_at || null,
    created_at: existing?.created_at || nowIso,
    updated_at: nowIso,
  };

  localMap[params.bookingId] = item;
  writeLocalQueue(localMap);

  if (adminClient && process.env.OAK_SKIP_SUPABASE_FALLBACK !== "1") {
    try {
      const { error: queueErr } = await adminClient.from("sheet_sync_queue").upsert(
        {
          id: item.id,
          booking_id: item.booking_id,
          slot_id: item.slot_id,
          sheet_row_index: item.sheet_row_index,
          action: item.action,
          status: item.status,
          attempts: item.attempts,
          max_attempts: item.max_attempts,
          last_error: item.last_error,
          next_retry_at: item.next_retry_at,
          payload: item.payload,
          synced_at: item.synced_at,
          updated_at: item.updated_at,
        },
        { onConflict: "booking_id" }
      );

      if (queueErr) {
        // Fallback: store queue snapshot in public.audit_log (which exists in live Supabase)
        await adminClient.from("audit_log").insert({
          action: "sheet_sync_queue",
          actor_email: "system@oak.uncommon.org",
          target_email: item.booking_id,
          details: {
            queue_id: item.id,
            booking_id: item.booking_id,
            slot_id: item.slot_id,
            sheet_row_index: item.sheet_row_index,
            status: item.status,
            attempts: item.attempts,
            max_attempts: item.max_attempts,
            last_error: item.last_error,
            next_retry_at: item.next_retry_at,
            synced_at: item.synced_at,
            updated_at: item.updated_at,
            payload: item.payload,
          },
          created_at: nowIso,
        });
      }
    } catch {
      // Never throw on queue persistence fallback
    }
  }

  return item;
}

/**
 * Lists all items in the sheet_sync_queue (latest state per booking_id).
 */
export async function listSheetSyncQueue(adminClient?: any): Promise<SheetSyncQueueItem[]> {
  const byBooking = new Map<string, SheetSyncQueueItem>();

  if (adminClient && process.env.OAK_SKIP_SUPABASE_FALLBACK !== "1") {
    try {
      const { data: rows, error } = await adminClient
        .from("sheet_sync_queue")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!error && Array.isArray(rows)) {
        for (const r of rows) {
          byBooking.set(String(r.booking_id), {
            id: r.id,
            booking_id: r.booking_id,
            slot_id: r.slot_id || null,
            sheet_row_index: r.sheet_row_index ?? null,
            action: "upsert",
            status: r.status,
            attempts: Number(r.attempts || 0),
            max_attempts: Number(r.max_attempts || 10),
            last_error: r.last_error || null,
            next_retry_at: r.next_retry_at || r.updated_at,
            payload: r.payload || ({} as any),
            synced_at: r.synced_at || null,
            created_at: r.created_at,
            updated_at: r.updated_at,
          });
        }
      } else {
        // Fallback: reconstruct latest queue state per booking_id from public.audit_log
        const { data: auditRows } = await adminClient
          .from("audit_log")
          .select("*")
          .eq("action", "sheet_sync_queue")
          .order("created_at", { ascending: false })
          .limit(200);

        if (Array.isArray(auditRows)) {
          for (const r of auditRows) {
            const d = r.details || {};
            const bookingId = String(d.booking_id || r.target_email || "");
            if (!bookingId || byBooking.has(bookingId)) continue;
            byBooking.set(bookingId, {
              id: String(d.queue_id || r.id),
              booking_id: bookingId,
              slot_id: d.slot_id || null,
              sheet_row_index: d.sheet_row_index ?? null,
              action: "upsert",
              status: d.status || "failed",
              attempts: Number(d.attempts || 1),
              max_attempts: Number(d.max_attempts || 10),
              last_error: d.last_error || null,
              next_retry_at: d.next_retry_at || r.created_at,
              payload: d.payload || ({} as any),
              synced_at: d.synced_at || null,
              created_at: r.created_at,
              updated_at: d.updated_at || r.created_at,
            });
          }
        }
      }
    } catch {
      // Fallback to local queue below
    }
  }

  const localMap = readLocalQueue();
  for (const [bookingId, item] of Object.entries(localMap)) {
    const existing = byBooking.get(bookingId);
    if (!existing || item.updated_at >= existing.updated_at) {
      byBooking.set(bookingId, item);
    }
  }

  return Array.from(byBooking.values()).sort((a, b) =>
    a.updated_at < b.updated_at ? 1 : -1
  );
}

/**
 * Returns a map of bookingId -> SheetSyncState combining memory/disk state and
 * durable Supabase queue state so serverless endpoints always report accurate sync statuses.
 */
export async function getDurableSyncStateMap(
  adminClient?: any
): Promise<Map<string, SheetSyncState>> {
  loadFallbackStoreFromDisk();
  const map = new Map<string, SheetSyncState>();
  for (const [k, v] of memorySyncStore.entries()) {
    map.set(k, v);
  }

  const queueItems = await listSheetSyncQueue(adminClient);
  for (const item of queueItems) {
    const syncStatus: SheetSyncStatus =
      item.status === "synced"
        ? "synced"
        : item.status === "failed"
        ? "failed"
        : "pending";
    map.set(item.booking_id, {
      sheet_sync_status: syncStatus,
      sheet_sync_error: item.last_error,
      sheet_synced_at: item.synced_at,
      sheet_row_index: item.sheet_row_index,
      attempts: item.attempts,
    });
  }

  return map;
}

/**
 * Safely persists sheet_sync_status, sheet_sync_error, and sheet_synced_at on a booking row.
 * Gracefully tolerates the columns being missing in the database without crashing.
 */
export async function updateBookingSheetSyncRecord(
  adminClient: any,
  bookingId: string,
  status: SheetSyncStatus,
  errorText?: string | null
): Promise<SheetSyncState> {
  loadFallbackStoreFromDisk();
  const nowIso = new Date().toISOString();
  const cleanError = status === "synced" ? null : sanitizeSheetError(errorText || "Sheet sync failed");
  const existingMem = memorySyncStore.get(bookingId);
  const state: SheetSyncState = {
    sheet_sync_status: status,
    sheet_sync_error: cleanError,
    sheet_synced_at: status === "synced" ? nowIso : existingMem?.sheet_synced_at || null,
    cancelled_at: existingMem?.cancelled_at || null,
  };

  memorySyncStore.set(bookingId, state);
  saveFallbackStoreToDisk();

  if (!adminClient) {
    return state;
  }

  try {
    const updatePayload: Record<string, any> = {
      sheet_sync_status: status,
      sheet_sync_error: cleanError,
    };
    if (status === "synced") {
      updatePayload.sheet_synced_at = nowIso;
    }

    const { error } = await adminClient
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (error) {
      if (
        error.code === "42703" ||
        /sheet_sync_|column .* does not exist|schema cache/i.test(error.message || "")
      ) {
        return state;
      }
      console.warn(`[SHEET SYNC DB WARNING] booking=${bookingId} status=db_update_warning`);
    }
  } catch {
    // Ignore DB update errors so sync never crashes caller
  }

  return state;
}

/**
 * Fetches a single booking with its slot and advisor from Supabase, tolerating missing optional columns.
 */
export async function fetchBookingForSheetSync(
  adminClient: any,
  bookingId: string
): Promise<any | null> {
  const buildSelect = (includeSyncCols: boolean, includeEmailError: boolean) => `
    id,
    slot_id,
    name,
    email,
    organisation,
    message,
    status,
    email_status,
    ${includeEmailError ? "email_error," : ""}
    ${includeSyncCols ? "cancelled_at, sheet_sync_status, sheet_sync_error, sheet_synced_at," : ""}
    created_at,
    slots:slot_id (
      id,
      advisor_id,
      start_time,
      end_time,
      duration_minutes,
      note,
      advisors:advisor_id (
        id,
        slug,
        full_name,
        job_title,
        email
      )
    )
  `;

  let { data, error } = await adminClient
    .from("bookings")
    .select(buildSelect(true, true))
    .eq("id", bookingId)
    .maybeSingle();

  if (error && /sheet_sync_|cancelled_at|column|schema cache/i.test(error.message || "")) {
    const retry1 = await adminClient
      .from("bookings")
      .select(buildSelect(false, true))
      .eq("id", bookingId)
      .maybeSingle();
    data = retry1.data;
    error = retry1.error;
  }

  if (error && /email_error|column|schema cache/i.test(error.message || "")) {
    const retry2 = await adminClient
      .from("bookings")
      .select(buildSelect(false, false))
      .eq("id", bookingId)
      .maybeSingle();
    data = retry2.data;
    error = retry2.error;
  }

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Syncs a single booking by ID to the Google Sheet ("upsert" + Columns I, J, K, L, O).
 * Awaited, enqueues/updates `sheet_sync_queue` with exponential backoff, and captures any
 * failure in `error_log` for the Super Admin dashboard alert.
 */
export async function syncBookingToSheetById(
  adminClient: any,
  bookingId: string,
  options?: {
    timeoutMs?: number;
    retryDelayMs?: number;
    baseBackoffMs?: number;
    fetchImpl?: typeof fetch;
    bookingOverride?: any;
  }
): Promise<{
  ok: boolean;
  status: SheetSyncStatus;
  error: string | null;
  syncedAt: string | null;
  sheetRowIndex?: number | null;
  attempts?: number;
}> {
  try {
    const bookingRow =
      options?.bookingOverride || (await fetchBookingForSheetSync(adminClient, bookingId));

    if (!bookingRow) {
      const errMsg = "Booking not found";
      console.warn(`[SHEET SYNC] booking=${bookingId} result=failed`);
      return { ok: false, status: "failed", error: errMsg, syncedAt: null };
    }

    const slot = Array.isArray(bookingRow?.slots) ? bookingRow.slots[0] : bookingRow?.slots;
    const slotTarget = await resolveSlotSheetTarget(adminClient, slot);
    const payload = buildSheetBookingPayload(bookingRow, slotTarget);

    const res = await postToSheetsWebhook(
      { action: "upsert", booking: payload },
      options
    );

    const syncStatus: SheetSyncStatus = res.ok ? "synced" : "failed";
    const state = await updateBookingSheetSyncRecord(
      adminClient,
      bookingId,
      syncStatus,
      res.error
    );

    const queueItem = await upsertSheetSyncQueueItem(adminClient, {
      bookingId,
      slotId: slotTarget.slotId || null,
      sheetRowIndex: slotTarget.sheetRowIndex,
      status: syncStatus,
      attemptsDelta: 1,
      lastError: res.error,
      payload,
      baseBackoffMs: options?.baseBackoffMs,
    });

    if (res.ok) {
      await resolveErrorLogs({ booking_id: bookingId }, adminClient);
    } else {
      await recordErrorLog(
        {
          source: "sheets_sync",
          severity: "error",
          booking_id: bookingId,
          slot_id: slotTarget.slotId || null,
          message: state.sheet_sync_error || "Failed to sync booking to Google Sheet",
          details: {
            sheet_row_index: slotTarget.sheetRowIndex,
            external_slot_id: slotTarget.externalSlotId,
            attempts: queueItem.attempts,
            next_retry_at: queueItem.next_retry_at,
            booker_name: payload.name,
            booker_email: payload.email,
            organisation: payload.organisation,
            slot_date: payload.date,
            slot_time: payload.time,
          },
        },
        adminClient
      );
    }

    console.log(
      `[SHEET SYNC] booking=${bookingId} row=${slotTarget.sheetRowIndex} result=${syncStatus} attempts=${queueItem.attempts}`
    );

    return {
      ok: res.ok,
      status: state.sheet_sync_status,
      error: state.sheet_sync_error,
      syncedAt: state.sheet_synced_at,
      sheetRowIndex: slotTarget.sheetRowIndex,
      attempts: queueItem.attempts,
    };
  } catch (err) {
    const cleanErr = sanitizeSheetError(err);
    const state = await updateBookingSheetSyncRecord(
      adminClient,
      bookingId,
      "failed",
      cleanErr
    );
    await recordErrorLog(
      {
        source: "sheets_sync",
        severity: "error",
        booking_id: bookingId,
        message: cleanErr,
      },
      adminClient
    );
    console.log(`[SHEET SYNC] booking=${bookingId} result=failed`);
    return {
      ok: false,
      status: "failed",
      error: state.sheet_sync_error,
      syncedAt: state.sheet_synced_at,
    };
  }
}

/**
 * Fetches all bookings and syncs them to the Google Sheet in batches of up to 50 ("bulk").
 * Also updates the persistent queue and error_log.
 */
export async function syncAllBookingsToSheet(
  adminClient: any,
  options?: {
    timeoutMs?: number;
    retryDelayMs?: number;
    baseBackoffMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<{
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  batches: number;
  error: string | null;
}> {
  try {
    const buildSelect = (includeSyncCols: boolean) => `
      id,
      slot_id,
      name,
      email,
      organisation,
      message,
      status,
      email_status,
      ${includeSyncCols ? "cancelled_at, sheet_sync_status, sheet_sync_error, sheet_synced_at," : ""}
      created_at,
      slots:slot_id (
        id,
        advisor_id,
        start_time,
        end_time,
        duration_minutes,
        note,
        advisors:advisor_id (
          id,
          slug,
          full_name,
          job_title,
          email
        )
      )
    `;

    let { data: bookings, error } = await adminClient
      .from("bookings")
      .select(buildSelect(true))
      .order("created_at", { ascending: true });

    if (error && /sheet_sync_|cancelled_at|column|schema cache/i.test(error.message || "")) {
      const retry = await adminClient
        .from("bookings")
        .select(buildSelect(false))
        .order("created_at", { ascending: true });
      bookings = retry.data;
      error = retry.error;
    }

    if (error) {
      return {
        ok: false,
        total: 0,
        succeeded: 0,
        failed: 0,
        batches: 0,
        error: "Failed to load bookings from database for bulk sync.",
      };
    }

    const rows: any[] = bookings || [];
    if (rows.length === 0) {
      return {
        ok: true,
        total: 0,
        succeeded: 0,
        failed: 0,
        batches: 0,
        error: null,
      };
    }

    let succeeded = 0;
    let failed = 0;
    let batches = 0;
    let lastError: string | null = null;

    for (let i = 0; i < rows.length; i += BULK_BATCH_SIZE) {
      batches++;
      const batchRows = rows.slice(i, i + BULK_BATCH_SIZE);
      const batchPayloads: SheetBookingPayload[] = [];
      const batchTargets: Array<{ slotId: string; externalSlotId: string; sheetRowIndex: number }> = [];

      for (const r of batchRows) {
        const slot = Array.isArray(r?.slots) ? r.slots[0] : r?.slots;
        const target = await resolveSlotSheetTarget(adminClient, slot);
        batchTargets.push(target);
        batchPayloads.push(buildSheetBookingPayload(r, target));
      }

      const res = await postToSheetsWebhook(
        { action: "bulk", bookings: batchPayloads },
        options
      );

      if (res.ok) {
        succeeded += batchRows.length;
        for (let idx = 0; idx < batchRows.length; idx++) {
          const r = batchRows[idx];
          const target = batchTargets[idx];
          const payload = batchPayloads[idx];
          await updateBookingSheetSyncRecord(adminClient, r.id, "synced", null);
          await upsertSheetSyncQueueItem(adminClient, {
            bookingId: r.id,
            slotId: target.slotId || null,
            sheetRowIndex: target.sheetRowIndex,
            status: "synced",
            attemptsDelta: 1,
            lastError: null,
            payload,
            baseBackoffMs: options?.baseBackoffMs,
          });
          await resolveErrorLogs({ booking_id: r.id }, adminClient);
        }
        console.log(
          `[SHEET SYNC BULK] batch=${batches} count=${batchRows.length} result=synced`
        );
      } else {
        failed += batchRows.length;
        lastError = res.error || "Bulk sync batch failed";
        for (let idx = 0; idx < batchRows.length; idx++) {
          const r = batchRows[idx];
          const target = batchTargets[idx];
          const payload = batchPayloads[idx];
          await updateBookingSheetSyncRecord(adminClient, r.id, "failed", lastError);
          const qItem = await upsertSheetSyncQueueItem(adminClient, {
            bookingId: r.id,
            slotId: target.slotId || null,
            sheetRowIndex: target.sheetRowIndex,
            status: "failed",
            attemptsDelta: 1,
            lastError,
            payload,
            baseBackoffMs: options?.baseBackoffMs,
          });
          await recordErrorLog(
            {
              source: "sheets_sync",
              severity: "error",
              booking_id: r.id,
              slot_id: target.slotId || null,
              message: lastError,
              details: {
                sheet_row_index: target.sheetRowIndex,
                external_slot_id: target.externalSlotId,
                attempts: qItem.attempts,
                next_retry_at: qItem.next_retry_at,
                booker_name: payload.name,
                booker_email: payload.email,
                organisation: payload.organisation,
                slot_date: payload.date,
                slot_time: payload.time,
              },
            },
            adminClient
          );
        }
        console.log(
          `[SHEET SYNC BULK] batch=${batches} count=${batchRows.length} result=failed`
        );
      }
    }

    return {
      ok: failed === 0,
      total: rows.length,
      succeeded,
      failed,
      batches,
      error: lastError,
    };
  } catch (err) {
    const cleanErr = sanitizeSheetError(err);
    return {
      ok: false,
      total: 0,
      succeeded: 0,
      failed: 0,
      batches: 0,
      error: cleanErr,
    };
  }
}

/**
 * Scheduled Queue Worker:
 * 1. Discovers any confirmed bookings in `public.bookings` that are not yet in `sheet_sync_queue`
 *    (or not yet `"synced"`) and enqueues them for backfill.
 * 2. Processes all due items in `sheet_sync_queue` (where `status !== 'synced'`,
 *    `attempts < max_attempts`, and `next_retry_at <= now` or `force === true`).
 * 3. Retries failed items with exponential backoff and logs failures to `error_log`.
 */
export async function processSheetSyncQueue(
  adminClient: any,
  options?: {
    force?: boolean;
    timeoutMs?: number;
    retryDelayMs?: number;
    baseBackoffMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<{
  ok: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  skippedNotDue: number;
  items: SheetSyncQueueItem[];
}> {
  const force = Boolean(options?.force);
  const nowIso = new Date().toISOString();

  // 1. Ensure all confirmed bookings in DB are represented in the queue
  const queueBefore = await listSheetSyncQueue(adminClient);
  const existingQueueByBooking = new Map<string, SheetSyncQueueItem>();
  for (const q of queueBefore) {
    existingQueueByBooking.set(q.booking_id, q);
  }

  let bookingIdsToProcess: string[] = [];

  if (adminClient) {
    const { data: confirmedBookings } = await adminClient
      .from("bookings")
      .select("id, status, created_at")
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    for (const b of confirmedBookings || []) {
      const q = existingQueueByBooking.get(b.id);
      if (!q) {
        bookingIdsToProcess.push(b.id);
      }
    }
  }

  let skippedNotDue = 0;
  for (const q of queueBefore) {
    if (q.status === "synced") continue;
    if (q.attempts >= q.max_attempts && !force) continue;
    if (!force && q.next_retry_at && q.next_retry_at > nowIso) {
      skippedNotDue++;
      continue;
    }
    if (!bookingIdsToProcess.includes(q.booking_id)) {
      bookingIdsToProcess.push(q.booking_id);
    }
  }

  let succeeded = 0;
  let failed = 0;

  for (const bookingId of bookingIdsToProcess) {
    const res = await syncBookingToSheetById(adminClient, bookingId, options);
    if (res.ok) {
      succeeded++;
    } else {
      failed++;
    }
  }

  const updatedQueue = await listSheetSyncQueue(adminClient);

  return {
    ok: failed === 0,
    processed: bookingIdsToProcess.length,
    succeeded,
    failed,
    skippedNotDue,
    items: updatedQueue,
  };
}

/**
 * Sends a "ping" action to the Apps Script webhook to verify the secret in the JSON body
 * and retrieve the scriptVersion and sheetTabName ("1-on-1 Booking Tracker").
 */
export async function pingSheetsWebhook(options?: {
  timeoutMs?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  status: number;
  scriptVersion: string | null;
  sheetTabName: string | null;
  allTabs?: string[];
  secretLength: number;
  urlEndsWithExec: boolean;
  cause: string | null;
  error: string | null;
  testedAt: string;
}> {
  const config = getSheetWebhookConfigStatus();
  const testedAt = new Date().toISOString();

  if (!config.isConfigured) {
    return {
      ok: false,
      status: 0,
      scriptVersion: null,
      sheetTabName: null,
      secretLength: config.secretLength || 0,
      urlEndsWithExec: config.urlEndsWithExec,
      cause: "missing configuration",
      error: "Missing SHEETS_WEBHOOK_URL or SHEETS_WEBHOOK_SECRET",
      testedAt,
    };
  }

  const res = await postToSheetsWebhook(
    {
      action: "ping",
      tabName: config.tabName || DEFAULT_SHEET_TAB_NAME,
    },
    options
  );

  return {
    ok: res.ok,
    status: res.status,
    scriptVersion: res.data?.scriptVersion || null,
    sheetTabName: res.data?.sheetTabName || res.data?.tabName || null,
    allTabs: Array.isArray(res.data?.allTabs) ? res.data.allTabs : undefined,
    secretLength: config.secretLength || 0,
    urlEndsWithExec: config.urlEndsWithExec,
    cause: res.cause || (res.unauthorized ? "secret mismatch or stale deployment" : null),
    error: res.ok ? null : res.error || "Ping failed",
    testedAt,
  };
}

/**
 * Tests the Google Sheet webhook connection without inserting dummy rows.
 * Calls "ping" first (returning scriptVersion & sheetTabName), and falls back to
 * zero-item "bulk" if the deployed Apps Script is an older version without "ping".
 */
export async function testSheetConnection(options?: {
  timeoutMs?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  hasUrl: boolean;
  hasSecret: boolean;
  isConfigured: boolean;
  urlEndsWithExec: boolean;
  urlEndsWithDev: boolean;
  isNotPlaceholder: boolean;
  secretLength?: number;
  scriptVersion?: string | null;
  sheetTabName?: string | null;
  cause?: string | null;
  sheetsApiConfigured?: boolean;
  error: string | null;
  testedAt: string;
}> {
  const config = getSheetWebhookConfigStatus();
  const testedAt = new Date().toISOString();

  if (!config.isConfigured) {
    const missing: string[] = [];
    if (!config.hasUrl) missing.push("SHEETS_WEBHOOK_URL");
    if (!config.hasSecret) missing.push("SHEETS_WEBHOOK_SECRET");
    return {
      ok: false,
      ...config,
      error:
        missing.length > 0
          ? `Missing environment variable(s): ${missing.join(", ")}`
          : "Environment variables contain placeholder values",
      testedAt,
    };
  }

  const pingRes = await pingSheetsWebhook(options);
  if (pingRes.ok) {
    return {
      ok: true,
      ...config,
      scriptVersion: pingRes.scriptVersion,
      sheetTabName: pingRes.sheetTabName,
      cause: null,
      error: null,
      testedAt,
    };
  }

  // If older script version returned "Unsupported action" for ping, fallback to zero-item bulk
  if (pingRes.error && /unsupported action/i.test(pingRes.error)) {
    const bulkRes = await postToSheetsWebhook({ action: "bulk", bookings: [] }, options);
    return {
      ok: bulkRes.ok,
      ...config,
      scriptVersion: "legacy-v1",
      sheetTabName: config.tabName,
      cause: bulkRes.cause || null,
      error: bulkRes.ok ? null : bulkRes.error || "Sheet webhook test failed",
      testedAt,
    };
  }

  return {
    ok: false,
    ...config,
    scriptVersion: pingRes.scriptVersion,
    sheetTabName: pingRes.sheetTabName,
    cause: pingRes.cause,
    error: pingRes.error || "Sheet webhook test failed",
    testedAt,
  };
}
