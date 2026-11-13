import fs from "fs";
import os from "os";
import path from "path";

export interface ErrorLogEntry {
  id: string;
  source: string;
  severity: "warning" | "error" | "critical";
  booking_id: string | null;
  slot_id: string | null;
  message: string;
  details: Record<string, any>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

const SENSITIVE_KEY_PATTERN = /token|secret|password|code|authorization|cookie|private_key/i;

function getErrorCacheFilePath(): string {
  return process.env.OAK_ERROR_LOG_FILE || path.join(os.tmpdir(), "oak-error-log.json");
}

function scrubDetails(input: Record<string, any> | undefined): Record<string, any> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = scrubDetails(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function readLocalErrorLogs(): ErrorLogEntry[] {
  try {
    const filePath = getErrorCacheFilePath();
    if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) return [];
    const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalErrorLogs(entries: ErrorLogEntry[]): void {
  try {
    const filePath = getErrorCacheFilePath();
    fs.writeFileSync(/*turbopackIgnore: true*/ filePath, JSON.stringify(entries.slice(0, 250), null, 2), "utf8");
  } catch {
    // Ignore local cache write errors
  }
}

async function getSupabaseAdmin(adminClient?: any): Promise<any | null> {
  if (adminClient) return adminClient;
  if (process.env.OAK_SKIP_SUPABASE_FALLBACK === "1") return null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key && !url.includes("your-project")) {
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  } catch {
    // Ignore client initialization errors
  }
  return null;
}

/**
 * Records a failure in error_log (persisting to public.error_log if migrated,
 * plus public.audit_log in Supabase Postgres so it is 100% durable across Vercel serverless invocations
 * even before the SQL migration is manually executed).
 */
export async function recordErrorLog(
  params: {
    source?: string;
    severity?: "warning" | "error" | "critical";
    booking_id?: string | null;
    slot_id?: string | null;
    message: string;
    details?: Record<string, any>;
  },
  adminClient?: any
): Promise<ErrorLogEntry> {
  const nowIso = new Date().toISOString();
  const entry: ErrorLogEntry = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: params.source || "sheets_sync",
    severity: params.severity || "error",
    booking_id: params.booking_id || null,
    slot_id: params.slot_id || null,
    message: String(params.message || "Unexpected system error").slice(0, 500),
    details: scrubDetails(params.details),
    resolved: false,
    resolved_at: null,
    created_at: nowIso,
  };

  // 1. Update local disk cache (deduplicate by booking_id + source when unresolved)
  const local = readLocalErrorLogs();
  const existingIdx = local.findIndex(
    (e) =>
      !e.resolved &&
      e.source === entry.source &&
      entry.booking_id &&
      e.booking_id === entry.booking_id
  );
  if (existingIdx >= 0) {
    entry.id = local[existingIdx].id;
    local[existingIdx] = entry;
  } else {
    local.unshift(entry);
  }
  writeLocalErrorLogs(local);

  console.error(
    `[ERROR_LOG] [${entry.severity.toUpperCase()}] source=${entry.source} booking=${entry.booking_id || "none"} slot=${entry.slot_id || "none"} msg=${entry.message}`
  );

  // 2. Persist to Supabase (public.error_log first, then durable public.audit_log fallback)
  const client = await getSupabaseAdmin(adminClient);
  if (client) {
    try {
      const { error: tableErr } = await client.from("error_log").insert({
        id: entry.id,
        source: entry.source,
        severity: entry.severity,
        booking_id: entry.booking_id,
        slot_id: entry.slot_id,
        message: entry.message,
        details: entry.details,
        resolved: false,
        created_at: entry.created_at,
      });

      if (tableErr) {
        // Fallback to public.audit_log which exists in live Supabase DB
        await client.from("audit_log").insert({
          action: "error_log",
          actor_email: "system@oak.uncommon.org",
          target_email: entry.booking_id || entry.slot_id || null,
          details: {
            error_id: entry.id,
            source: entry.source,
            severity: entry.severity,
            booking_id: entry.booking_id,
            slot_id: entry.slot_id,
            message: entry.message,
            resolved: false,
            ...entry.details,
          },
          created_at: entry.created_at,
        });
      }
    } catch {
      // Never throw from error logger
    }
  }

  return entry;
}

/**
 * Marks error_log entries as resolved (by error ID or by booking_id).
 */
export async function resolveErrorLogs(
  filter: { id?: string; booking_id?: string; all?: boolean },
  adminClient?: any
): Promise<void> {
  const nowIso = new Date().toISOString();
  const local = readLocalErrorLogs();
  let changed = false;

  for (const item of local) {
    if (item.resolved) continue;
    if (
      filter.all ||
      (filter.id && item.id === filter.id) ||
      (filter.booking_id && item.booking_id === filter.booking_id)
    ) {
      item.resolved = true;
      item.resolved_at = nowIso;
      changed = true;
    }
  }
  if (changed) {
    writeLocalErrorLogs(local);
  }

  const client = await getSupabaseAdmin(adminClient);
  if (client) {
    try {
      let query = client
        .from("error_log")
        .update({ resolved: true, resolved_at: nowIso })
        .eq("resolved", false);

      if (filter.id) {
        query = query.eq("id", filter.id);
      } else if (filter.booking_id) {
        query = query.eq("booking_id", filter.booking_id);
      }

      const { error: err } = await query;
      if (err) {
        // Record resolution marker in public.audit_log fallback
        await client.from("audit_log").insert({
          action: "error_log_resolved",
          actor_email: "system@oak.uncommon.org",
          target_email: filter.booking_id || filter.id || "all",
          details: {
            resolved_error_id: filter.id || null,
            resolved_booking_id: filter.booking_id || null,
            resolved_all: Boolean(filter.all),
            resolved_at: nowIso,
          },
          created_at: nowIso,
        });
      }
    } catch {
      // Ignore resolution errors
    }
  }
}

/**
 * Lists error_log entries (unresolved by default) from public.error_log,
 * falling back to public.audit_log and local disk cache.
 */
export async function listErrorLogs(
  options?: { includeResolved?: boolean; limit?: number },
  adminClient?: any
): Promise<ErrorLogEntry[]> {
  const includeResolved = Boolean(options?.includeResolved);
  const limit = options?.limit ?? 50;
  const mergedByKey = new Map<string, ErrorLogEntry>();

  const getDedupKey = (e: ErrorLogEntry) =>
    e.booking_id ? `${e.source}:booking:${e.booking_id}` : `${e.source}:id:${e.id}`;

  const client = await getSupabaseAdmin(adminClient);
  if (client) {
    try {
      let query = client
        .from("error_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!includeResolved) {
        query = query.eq("resolved", false);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const entry: ErrorLogEntry = {
            id: row.id,
            source: row.source || "sheets_sync",
            severity: row.severity || "error",
            booking_id: row.booking_id || null,
            slot_id: row.slot_id || null,
            message: row.message || "Error",
            details: row.details || {},
            resolved: Boolean(row.resolved),
            resolved_at: row.resolved_at || null,
            created_at: row.created_at,
          };
          const key = getDedupKey(entry);
          if (!mergedByKey.has(key)) {
            mergedByKey.set(key, entry);
          }
        }
      } else {
        // Fallback: query public.audit_log for error_log and error_log_resolved events
        const { data: auditRows } = await client
          .from("audit_log")
          .select("*")
          .in("action", ["error_log", "error_log_resolved"])
          .order("created_at", { ascending: false })
          .limit(200);

        if (Array.isArray(auditRows)) {
          const resolvedIds = new Set<string>();
          const resolvedBookings = new Set<string>();
          let resolvedAllBefore: string | null = null;

          for (const r of auditRows) {
            if (r.action === "error_log_resolved") {
              const d = r.details || {};
              if (d.resolved_all && (!resolvedAllBefore || r.created_at > resolvedAllBefore)) {
                resolvedAllBefore = r.created_at;
              }
              if (d.resolved_error_id) resolvedIds.add(String(d.resolved_error_id));
              if (d.resolved_booking_id) resolvedBookings.add(String(d.resolved_booking_id));
            }
          }

          for (const r of auditRows) {
            if (r.action !== "error_log") continue;
            const d = r.details || {};
            const errId = String(d.error_id || r.id);
            const bookingId = d.booking_id ? String(d.booking_id) : null;
            const isResolved =
              Boolean(d.resolved) ||
              resolvedIds.has(errId) ||
              (bookingId ? resolvedBookings.has(bookingId) : false) ||
              Boolean(resolvedAllBefore && r.created_at <= resolvedAllBefore);

            if (!includeResolved && isResolved) continue;

            const entry: ErrorLogEntry = {
              id: errId,
              source: d.source || "sheets_sync",
              severity: d.severity || "error",
              booking_id: bookingId,
              slot_id: d.slot_id ? String(d.slot_id) : null,
              message: d.message || "Sheet sync failed",
              details: d,
              resolved: isResolved,
              resolved_at: isResolved ? r.created_at : null,
              created_at: r.created_at,
            };
            const key = getDedupKey(entry);
            if (!mergedByKey.has(key)) {
              mergedByKey.set(key, entry);
            }
          }
        }
      }
    } catch {
      // Ignore query error and fall back to local cache
    }
  }

  for (const localEntry of readLocalErrorLogs()) {
    if (!includeResolved && localEntry.resolved) continue;
    const key = getDedupKey(localEntry);
    if (!mergedByKey.has(key)) {
      mergedByKey.set(key, localEntry);
    }
  }

  return Array.from(mergedByKey.values())
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}
