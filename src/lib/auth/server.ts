import { NextResponse } from "next/server";
import { createClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { isEmailVerified, isValidAdminEmailDomain } from "./policy";
import { getAdminUser, AdminUserRecord } from "./admin-users";
import { logAuditEvent } from "@/lib/audit";

export interface AdminAuthResult {
  response?: NextResponse;
  client?: any;
  user?: any;
  adminUser?: AdminUserRecord;
}

/**
 * Enforces admin authorization rules on every server action / API route:
 * (1) Provider reports email as verified.
 * (2) Domain is strictly one of the allowed domains (oakfnd.org, oakfnd.ch, uncommon.org).
 * (3) Exact lowercase email is present in admin_users with is_active = true.
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  if (!isSupabaseServerConfigured()) {
    return {
      response: NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 }),
    };
  }

  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user || !user.email) {
    return {
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  const email = user.email.toLowerCase().trim();

  // 1. Email verification check
  if (!isEmailVerified(user)) {
    await logAuditEvent({
      action: "login_denied",
      actor_email: email,
      details: { reason: "email_not_verified" },
    });
    return {
      response: NextResponse.json({ error: "Email address not verified by provider" }, { status: 403 }),
    };
  }

  // 2. Domain check
  if (!isValidAdminEmailDomain(email)) {
    await logAuditEvent({
      action: "login_denied",
      actor_email: email,
      details: { reason: "unauthorized_domain" },
    });
    return {
      response: NextResponse.json({ error: "Domain not authorized for administrative access" }, { status: 403 }),
    };
  }

  // 3. Database admin allowlist check
  const adminUser = await getAdminUser(email);
  if (!adminUser || !adminUser.is_active) {
    await logAuditEvent({
      action: "login_denied",
      actor_email: email,
      details: { reason: adminUser ? "account_deactivated" : "not_in_admin_allowlist" },
    });
    return {
      response: NextResponse.json(
        { error: "Administrative access denied. User is not an active admin." },
        { status: 403 }
      ),
    };
  }

  return { client, user, adminUser };
}

/**
 * Enforces super admin privileges (Tapiwa Chikwanha / role = super_admin).
 */
export async function requireSuperAdmin(): Promise<AdminAuthResult> {
  const result = await requireAdmin();
  if (result.response) return result;

  if (result.adminUser?.role !== "super_admin") {
    await logAuditEvent({
      action: "login_denied",
      actor_email: result.user?.email,
      details: { reason: "super_admin_required" },
    });
    return {
      response: NextResponse.json(
        { error: "Super administrator access required." },
        { status: 403 }
      ),
    };
  }

  return result;
}

/**
 * Backward compatibility alias for existing code calling requireStaff().
 */
export async function requireStaff(): Promise<AdminAuthResult> {
  return requireAdmin();
}

/**
 * General user authentication guard (attendees or staff).
 */
export async function requireUser() {
  if (!isSupabaseServerConfigured()) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { client, user };
}
