import { isSeededAdmin, getAdminUser } from "./admin-users";
import { isValidAdminEmailDomain, isEmailVerified } from "./domains";

export * from "./domains";

export const AUTH_COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

/**
 * Synchronous check for staff/admin status.
 * Re-evaluates verified status, exact domain match, and presence in the seeded active admin list.
 */
export function isStaffUser(
  user: {
    email?: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
  } | null | undefined
): boolean {
  if (!user || !user.email) return false;
  if (!isEmailVerified(user)) return false;

  const email = user.email.toLowerCase().trim();
  if (!isValidAdminEmailDomain(email)) return false;

  return isSeededAdmin(email);
}

/**
 * Asynchronous check for staff/admin status.
 * Evaluates provider verification, domain allowlist, and queries the database `admin_users` table
 * where email matches lowercase and is_active = true.
 */
export async function isStaffUserAsync(
  user: {
    id?: string;
    email?: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
  } | null | undefined
): Promise<boolean> {
  if (!user || !user.email) return false;
  if (!isEmailVerified(user)) return false;

  const email = user.email.toLowerCase().trim();
  if (!isValidAdminEmailDomain(email)) return false;

  const admin = await getAdminUser(email);
  return Boolean(admin && admin.is_active);
}

export function safeAdminPath(value: string | null): string {
  if (!value || !/^\/admin(?:\/|$)/.test(value) || /[\\?#\r\n]/.test(value)) return "/admin";
  const url = new URL(value, "https://local.invalid");
  return url.pathname === "/admin" || url.pathname.startsWith("/admin/") ? url.pathname : "/admin";
}

export function safeRedirectPath(value: string | null, fallback = "/admin"): string {
  if (!value || /[\\?#\r\n]/.test(value)) return fallback;
  if (/^\/(?:admin|directory|programme|drive|pass(?:\/|$)|register|book(?:\/|$)|$)(?:[\w\-\/]*)$/.test(value)) {
    return value;
  }
  return fallback;
}

export function isSameOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin;
}
