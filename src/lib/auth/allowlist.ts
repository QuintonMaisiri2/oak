import { getAdminUser, AdminUserRecord } from "./admin-users";

/**
 * Normalises an email address by trimming whitespace and converting to lowercase.
 * Must be used on both save and compare across all auth and registration flows.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Exact domain check for Oak Foundation staff (@oakfnd.ch).
 * The normalised email must have a valid non-empty local part and end strictly with "@oakfnd.ch".
 * Rejects subdomains (e.g. user@sub.oakfnd.ch), lookalikes (e.g. user@evil-oakfnd.ch),
 * or strings without an "@" separator.
 */
export function isExactOakStaffDomain(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return false;
  // Ensure there is only one '@' and the domain part is exactly 'oakfnd.ch'
  if (normalized.lastIndexOf("@") !== atIndex) return false;

  const localPart = normalized.slice(0, atIndex);
  const domainSuffix = normalized.slice(atIndex); // includes leading '@'

  if (!/^[a-z0-9._%+-]+$/.test(localPart)) return false;

  return domainSuffix === "@oakfnd.ch";
}

/**
 * Checks whether an email looks like a subdomain or lookalike of oakfnd.ch
 * (for reporting 'domain_mismatch' in audit logs).
 */
export function isMismatchedOakDomain(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || isExactOakStaffDomain(normalized)) return false;
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) return false;
  const domain = normalized.slice(atIndex + 1);
  return domain.endsWith(".oakfnd.ch") || (domain.includes("oakfnd") && domain !== "oakfnd.org" && domain !== "oakfnd.ch");
}

/**
 * Strictly requires the Google OAuth `email_verified` claim to be boolean `true`.
 */
export function isGoogleEmailVerified(
  user: {
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
    identities?: Array<{ identity_data?: Record<string, any> }>;
  } | null | undefined
): boolean {
  if (!user) return false;
  if (user.user_metadata?.email_verified === true) return true;
  if (user.app_metadata?.email_verified === true) return true;
  if (Array.isArray(user.identities)) {
    for (const id of user.identities) {
      if (id?.identity_data?.email_verified === true) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Explicit sign-in allow-list for named individuals (normalised to lowercase & trimmed).
 * Note: Individual grantee emails registered in `public.attendees` are also explicitly allowed.
 */
export const EXPLICIT_SIGNIN_ALLOWLIST: readonly string[] = Object.freeze(
  [
    "alice.gentile@oakfnd.ch",
    "silvia.guizzardi@oakfnd.ch",
    "adriana.craciun@oakfnd.ch",
    "cheryl.chang@oakfnd.ch",
    "karl.riber@oakfnd.org",
    "merciful.machuwe@oakfnd.org",
  ].map((e) => normalizeEmail(e))
);

export function getExplicitSignInAllowlist(): Set<string> {
  const set = new Set<string>(EXPLICIT_SIGNIN_ALLOWLIST);
  const envList = process.env.SIGNIN_ALLOWLIST_EMAILS || "";
  if (envList) {
    for (const raw of envList.split(",")) {
      const clean = normalizeEmail(raw);
      if (clean) set.add(clean);
    }
  }
  return set;
}

export function isExplicitlyAllowlistedEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getExplicitSignInAllowlist().has(normalized);
}

export type SignInDenialReason =
  | "not_allowed"
  | "unverified_email"
  | "provider_error"
  | "callback_error"
  | "cancelled"
  | "domain_mismatch";

export interface SignInEvaluationResult {
  allowed: boolean;
  email: string;
  reason?: SignInDenialReason;
  accessLevel: "super_admin" | "admin" | "basic" | "none";
  isAdmin: boolean;
  isOakStaff: boolean;
  adminUser?: AdminUserRecord | null;
  attendee?: {
    id: string;
    event_code: string;
    first_name: string;
    last_name: string;
    role: string;
    email: string;
    organization: string;
  } | null;
}

/**
 * Server-side allow-list enforcement executed after Google OAuth (`/api/auth/callback`) or email OTP
 * verification (`/api/auth/otp/verify`).
 * Rules:
 * 1. Email is normalised (trimmed & lowercased).
 * 2. Google `email_verified` claim MUST be `true` (otherwise denied with `unverified_email`).
 * 3. Admin and Super Admin roles come strictly from the explicit `admin_users` allow-list.
 *    If a user is in `admin_users` with `is_active: false`, they are denied (`not_allowed`).
 * 4. Every verified email ending with `@oakfnd.ch` (exact domain match) OR on `EXPLICIT_SIGNIN_ALLOWLIST`
 *    (including `alice.gentile@oakfnd.ch`) is allowed with basic access (`accessLevel: "basic"`, unless also on the explicit admin list).
 * 5. Individual grantee/participant emails present in `public.attendees` (exact lowercase match) are allowed with basic access.
 * 6. Everyone else is denied (`domain_mismatch` or `not_allowed`).
 */
export async function evaluateSignInAllowlist(
  user: {
    id?: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
    identities?: Array<{ identity_data?: Record<string, any> }>;
  } | null | undefined,
  adminClient: any,
  options: {
    /** Set when ownership of the mailbox was proven by an emailed one-time code (no Google claim exists). */
    emailVerifiedByOtp?: boolean;
  } = {}
): Promise<SignInEvaluationResult> {
  const email = normalizeEmail(user?.email);

  if (!email) {
    return {
      allowed: false,
      email: "",
      reason: "callback_error",
      accessLevel: "none",
      isAdmin: false,
      isOakStaff: false,
    };
  }

  // 1. Require Google email_verified claim === true (or a verified email OTP)
  if (!options.emailVerifiedByOtp && !isGoogleEmailVerified(user)) {
    return {
      allowed: false,
      email,
      reason: "unverified_email",
      accessLevel: "none",
      isAdmin: false,
      isOakStaff: false,
    };
  }

  // 2. Check for malformed/mismatched Oak lookalike or subdomain (e.g. @sub.oakfnd.ch)
  if (isMismatchedOakDomain(email)) {
    return {
      allowed: false,
      email,
      reason: "domain_mismatch",
      accessLevel: "none",
      isAdmin: false,
      isOakStaff: false,
    };
  }

  // 3. Check explicit Admin / Super Admin allow-list
  const adminUser = await getAdminUser(email);
  if (adminUser && !adminUser.is_active) {
    // Explicitly deactivated admin account
    return {
      allowed: false,
      email,
      reason: "not_allowed",
      accessLevel: "none",
      isAdmin: false,
      isOakStaff: false,
      adminUser,
    };
  }

  const isAdmin = Boolean(adminUser && adminUser.is_active);
  const isOakDomain = isExactOakStaffDomain(email);
  const isExplicitEmail = isExplicitlyAllowlistedEmail(email);

  // 4. Look up existing attendee record (exact normalised lowercase match)
  let attendee: SignInEvaluationResult["attendee"] = null;
  if (adminClient) {
    try {
      const { data } = await adminClient
        .from("attendees")
        .select("id, event_code, first_name, last_name, role, email, organization")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && normalizeEmail(data.email) === email) {
        attendee = {
          ...data,
          email: normalizeEmail(data.email),
        };
      }
    } catch (err) {
      console.warn("[evaluateSignInAllowlist] Attendee lookup warning:", err);
    }
  }

  // 5. Grant access if Admin, Oak Staff (@oakfnd.ch), Explicitly Allow-listed (alice.gentile@oakfnd.ch), or Registered Grantee/Attendee
  if (isAdmin) {
    return {
      allowed: true,
      email,
      accessLevel: adminUser!.role,
      isAdmin: true,
      isOakStaff: isOakDomain || adminUser!.team === "OAK",
      adminUser,
      attendee,
    };
  }

  if (isOakDomain || isExplicitEmail) {
    return {
      allowed: true,
      email,
      accessLevel: "basic",
      isAdmin: false,
      isOakStaff: true,
      adminUser: null,
      attendee,
    };
  }

  if (attendee && attendee.event_code) {
    return {
      allowed: true,
      email,
      accessLevel: "basic",
      isAdmin: false,
      isOakStaff: false,
      adminUser: null,
      attendee,
    };
  }

  return {
    allowed: false,
    email,
    reason: "not_allowed",
    accessLevel: "none",
    isAdmin: false,
    isOakStaff: false,
  };
}
