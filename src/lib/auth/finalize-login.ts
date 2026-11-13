import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { AUTH_COOKIE_OPTIONS, safeAdminPath, safeRedirectPath } from "@/lib/auth/policy";
import { getAdminUser } from "@/lib/auth/admin-users";
import {
  evaluateSignInAllowlist,
  isExactOakStaffDomain,
  isExplicitlyAllowlistedEmail,
  isMismatchedOakDomain,
  normalizeEmail,
  type SignInEvaluationResult,
} from "@/lib/auth/allowlist";
import { logAuditEvent } from "@/lib/audit";
import { PASS_ACCESS_COOKIE, PASS_ACCESS_MAX_AGE, signPassAccess } from "@/lib/auth/pass-access";
import { generateEventCode } from "@/lib/qr";

export type LoginMethod = "google" | "email_otp";

type LoginAttendee = NonNullable<SignInEvaluationResult["attendee"]>;

export type LoginResult =
  | { ok: true; destination: string; email: string; attendee: LoginAttendee | null }
  | { ok: false; destination: string };

export function generateRequestId(): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `ERR-${rand}`;
}

export function getClientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** Escapes LIKE wildcards so `ilike` behaves as a case-insensitive exact match. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Pre-check used before emailing a one-time code: mirrors the rules in `evaluateSignInAllowlist`
 * (active admin, exact @oakfnd.ch, explicit allow-list, or registered attendee).
 */
export async function isEligibleForSignIn(rawEmail: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email || isMismatchedOakDomain(email)) return false;

  const adminUser = await getAdminUser(email);
  if (adminUser) return adminUser.is_active;
  if (isExactOakStaffDomain(email) || isExplicitlyAllowlistedEmail(email)) return true;

  const { data } = await createAdminClient()
    .from("attendees")
    .select("event_code, email")
    .ilike("email", escapeLikePattern(email))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean(data?.event_code && normalizeEmail(data.email) === email);
}

/**
 * Shared post-authentication logic for every sign-in method (Google OAuth, email OTP).
 * Enforces the sign-in allow-list, auto-provisions staff passes, writes the audit log,
 * and picks the redirect. On denial the session is signed out and the auth user removed.
 */
export async function resolveLogin(params: {
  client: SupabaseClient;
  user: User;
  nextParam: string | null;
  clientIp: string | null;
  userAgent: string | null;
  requestId: string;
  method: LoginMethod;
}): Promise<LoginResult> {
  const { client, user, nextParam, clientIp, userAgent, requestId, method } = params;
  const adminClient = createAdminClient();

  // Server-side allow-list enforcement BEFORE any session cookies or data access are granted
  const decision = await evaluateSignInAllowlist(user, adminClient, {
    emailVerifiedByOtp: method === "email_otp",
  });

  if (!decision.allowed) {
    const reasonCode = decision.reason || "not_allowed";

    await logAuditEvent({
      action: "login_denied",
      actor_email: decision.email,
      reason: reasonCode,
      ip_address: clientIp,
      user_agent: userAgent,
      request_id: requestId,
      details: {
        domain: decision.email.split("@")[1] || "",
        method,
      },
    });

    // Sign the user out immediately
    await client.auth.signOut().catch(() => {});

    // Delete the unauthorized account from Supabase Auth so no usable account is left behind
    if (user.id) {
      await adminClient.auth.admin.deleteUser(user.id).catch((delErr) => {
        console.warn("[auth] Could not remove unauthorized auth user:", delErr?.message);
      });
    }

    const errorSlug =
      reasonCode === "unverified_email"
        ? "unverified-email"
        : reasonCode === "domain_mismatch"
        ? "domain-mismatch"
        : "not-allowed";

    return {
      ok: false,
      destination: `/admin/login?error=${errorSlug}&email=${encodeURIComponent(decision.email)}&ref=${encodeURIComponent(requestId)}`,
    };
  }

  const email = normalizeEmail(decision.email);
  let attendee = decision.attendee || null;

  // Auto-provision attendee pass record for first-time Oak staff (@oakfnd.ch),
  // explicitly allow-listed users (e.g. alice.gentile@oakfnd.ch), or active admins
  if (!attendee && (decision.isAdmin || decision.isOakStaff || isExplicitlyAllowlistedEmail(email))) {
    const rawFullName = (
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      decision.adminUser?.full_name ||
      ""
    ).trim();

    const derivedName =
      rawFullName ||
      email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const nameParts = derivedName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "Staff";
    const lastName = nameParts.slice(1).join(" ") || "Member";
    const eventCode = generateEventCode();
    const isOak = decision.isOakStaff || decision.adminUser?.team === "OAK";
    const orgName = isOak ? "OAK Foundation" : "Uncommon";
    const staffRole = isOak ? "OAK Staff" : "Coordination Team";

    const { data: newAttendee, error: createErr } = await adminClient
      .from("attendees")
      .insert({
        event_code: eventCode,
        first_name: firstName,
        last_name: lastName,
        organization: orgName,
        role: staffRole,
        email,
        consent_given_at: new Date().toISOString(),
      })
      .select("id, event_code, first_name, last_name, role, email, organization")
      .single();

    if (!createErr && newAttendee) {
      attendee = {
        ...newAttendee,
        email: normalizeEmail(newAttendee.email),
      };
    }
  }

  // Log successful sign-in to audit_log (never logging tokens, codes, or secrets)
  await logAuditEvent({
    action: "login_success",
    actor_email: email,
    ip_address: clientIp,
    user_agent: userAgent,
    request_id: requestId,
    details: {
      access_level: decision.accessLevel,
      is_admin: decision.isAdmin,
      is_oak_staff: decision.isOakStaff,
      role: decision.adminUser?.role || attendee?.role || "OAK Staff",
      method,
    },
  });

  // Determine redirect destination based on access level (Admin vs Basic access)
  const defaultPassPath = attendee?.event_code ? `/pass/${attendee.event_code}` : "/directory";

  const isBasicAllowedNext = Boolean(
    nextParam &&
      (nextParam.startsWith("/pass") ||
        nextParam === "/directory" ||
        nextParam.startsWith("/directory/") ||
        nextParam === "/programme" ||
        nextParam.startsWith("/programme/") ||
        nextParam === "/drive" ||
        nextParam === "/" ||
        nextParam.startsWith("/book"))
  );

  let destination: string;
  if (decision.isAdmin) {
    if (isBasicAllowedNext) {
      destination = safeRedirectPath(nextParam, defaultPassPath);
    } else if (nextParam && nextParam.startsWith("/admin")) {
      destination = safeAdminPath(nextParam);
    } else {
      destination = "/admin";
    }
  } else {
    // Basic access (Oak staff @oakfnd.ch, alice.gentile@oakfnd.ch, and allow-listed grantees):
    // Never redirect basic-access users to /admin (which requires explicit admin role).
    destination = isBasicAllowedNext ? safeRedirectPath(nextParam, defaultPassPath) : defaultPassPath;
  }

  return { ok: true, destination, email, attendee };
}

/** Sets the pass-access and bookmark cookies for a signed-in attendee. */
export function applyAttendeeCookies(response: NextResponse, attendee: LoginAttendee | null, email: string) {
  if (!attendee || !attendee.event_code) return;
  const secret = process.env.REGISTRATION_RPC_SECRET;
  if (secret) {
    response.cookies.set(PASS_ACCESS_COOKIE, signPassAccess(attendee.event_code, secret), {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: PASS_ACCESS_MAX_AGE,
    });
  }
  response.cookies.set("oak_partner_pass", attendee.event_code, {
    ...AUTH_COOKIE_OPTIONS,
    expires: new Date("2026-11-11T23:59:59Z"),
  });
  response.cookies.set("oak_attendee_email", email, {
    ...AUTH_COOKIE_OPTIONS,
    expires: new Date("2026-11-11T23:59:59Z"),
  });
}
