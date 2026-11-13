import fs from "fs";
import os from "os";
import path from "path";

export type AuthFailureReasonCode =
  | "not_allowed"
  | "unverified_email"
  | "provider_error"
  | "callback_error"
  | "cancelled"
  | "domain_mismatch";

export interface AuditLogEntry {
  id?: string;
  action:
    | "login_success"
    | "login_denied"
    | "admin_added"
    | "admin_role_changed"
    | "admin_deactivated"
    | "admin_reactivated"
    | "admin_removed"
    | string;
  actor_email?: string | null;
  target_email?: string | null;
  reason?: AuthFailureReasonCode | string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  details?: Record<string, any>;
  created_at?: string;
}

const memoryAuditLogs: AuditLogEntry[] = [];
const MAX_MEMORY_LOGS = 300;
const FALLBACK_AUDIT_FILE = path.join(os.tmpdir(), "oak-audit-log.jsonl");

const SENSITIVE_KEY_PATTERN = /token|secret|password|code|authorization|cookie|private_key/i;

/**
 * Recursively strips any tokens, codes, or secrets from audit details.
 */
function scrubSensitiveDetails(input: Record<string, any> | undefined): Record<string, any> {
  if (!input || typeof input !== "object") return {};
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      cleaned[k] = scrubSensitiveDetails(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

function appendAuditFile(entry: AuditLogEntry): void {
  try {
    fs.appendFileSync(FALLBACK_AUDIT_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // Ignore file write warnings
  }
}

function readAuditFile(limit: number): AuditLogEntry[] {
  try {
    if (!fs.existsSync(FALLBACK_AUDIT_FILE)) return [];
    const lines = fs
      .readFileSync(FALLBACK_AUDIT_FILE, "utf8")
      .split(/\r?\n/)
      .filter(Boolean);
    const parsed: AuditLogEntry[] = [];
    for (let i = lines.length - 1; i >= 0 && parsed.length < limit; i--) {
      try {
        parsed.push(JSON.parse(lines[i]));
      } catch {
        // Skip malformed line
      }
    }
    return parsed;
  } catch {
    return [];
  }
}

export async function logAuditEvent(entry: {
  action: string;
  actor_email?: string | null;
  target_email?: string | null;
  reason?: AuthFailureReasonCode | string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  details?: Record<string, any>;
}) {
  const normalizedActor = entry.actor_email ? entry.actor_email.trim().toLowerCase() : null;
  const normalizedTarget = entry.target_email ? entry.target_email.trim().toLowerCase() : null;
  const timestamp = new Date().toISOString();

  const safeDetails = scrubSensitiveDetails(entry.details);
  const reason = entry.reason || safeDetails.reason || null;
  const requestId = entry.request_id || safeDetails.request_id || null;
  const userAgent = entry.user_agent || safeDetails.user_agent || null;

  if (reason) safeDetails.reason = reason;
  if (requestId) safeDetails.request_id = requestId;
  if (userAgent) safeDetails.user_agent = userAgent;

  const logRecord: AuditLogEntry = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action: entry.action,
    actor_email: normalizedActor,
    target_email: normalizedTarget,
    reason,
    ip_address: entry.ip_address || null,
    user_agent: userAgent,
    request_id: requestId,
    details: safeDetails,
    created_at: timestamp,
  };

  memoryAuditLogs.unshift(logRecord);
  if (memoryAuditLogs.length > MAX_MEMORY_LOGS) {
    memoryAuditLogs.pop();
  }
  appendAuditFile(logRecord);

  console.log(
    `[AUDIT LOG] ${timestamp} [${entry.action.toUpperCase()}] ` +
      `actor=${normalizedActor || "anonymous"} ` +
      `reason=${reason || "none"} ` +
      `request_id=${requestId || "none"} ` +
      `ip=${entry.ip_address || "unknown"} ` +
      `ua=${userAgent ? JSON.stringify(userAgent.slice(0, 120)) : "unknown"} ` +
      `details=${JSON.stringify(safeDetails)}`
  );

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key && !url.includes("your-project")) {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const payload = {
        action: logRecord.action,
        actor_email: logRecord.actor_email,
        target_email: logRecord.target_email,
        reason: logRecord.reason,
        ip_address: logRecord.ip_address,
        user_agent: logRecord.user_agent,
        request_id: logRecord.request_id,
        details: logRecord.details,
        created_at: logRecord.created_at,
      };

      // Try audit_log first, then fallback to audit_logs (without optional columns if needed)
      const { error: err1 } = await adminClient.from("audit_log").insert(payload);
      if (err1) {
        const { error: err2 } = await adminClient.from("audit_logs").insert({
          action: logRecord.action,
          actor_email: logRecord.actor_email,
          target_email: logRecord.target_email,
          details: logRecord.details,
          ip_address: logRecord.ip_address,
          created_at: logRecord.created_at,
        });
        if (err2 && !/schema cache|does not exist/i.test(err2.message || "")) {
          console.warn("[AUDIT LOG INSERT WARNING]:", err2.message);
        }
      }
    }
  } catch (err) {
    console.warn("[AUDIT LOG ERROR]:", err);
  }
}

/**
 * List audit logs (Super Admin only).
 */
export async function listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key && !url.includes("your-project")) {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: data1, error: err1 } = await adminClient
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!err1 && Array.isArray(data1) && data1.length > 0) {
        return data1.map((d) => ({
          id: d.id,
          action: d.action,
          actor_email: d.actor_email,
          target_email: d.target_email,
          reason: d.reason || d.details?.reason || null,
          ip_address: d.ip_address,
          user_agent: d.user_agent || d.details?.user_agent || null,
          request_id: d.request_id || d.details?.request_id || null,
          details: d.details || {},
          created_at: d.created_at,
        }));
      }

      const { data: data2, error: err2 } = await adminClient
        .from("audit_logs")
        .select("id, action, actor_email, target_email, details, ip_address, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!err2 && Array.isArray(data2) && data2.length > 0) {
        return data2.map((d) => ({
          id: d.id,
          action: d.action,
          actor_email: d.actor_email,
          target_email: d.target_email,
          reason: d.details?.reason || null,
          ip_address: d.ip_address,
          user_agent: d.details?.user_agent || null,
          request_id: d.details?.request_id || null,
          details: d.details || {},
          created_at: d.created_at,
        }));
      }
    }
  } catch (err) {
    console.warn("[listAuditLogs] Database query error, using fallback logs:", err);
  }

  const diskLogs = readAuditFile(limit);
  if (diskLogs.length > 0) {
    return diskLogs;
  }
  return [...memoryAuditLogs].slice(0, limit);
}
