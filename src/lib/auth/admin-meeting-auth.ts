import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth/server";
import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { isValidAdminEmailDomain } from "@/lib/auth/policy";
import { getAdminUser } from "@/lib/auth/admin-users";

export interface MeetingAdminAuthResult {
  authorized: boolean;
  adminEmail: string;
  status?: number;
}

/**
 * Unified verification for Meeting & Advisor Admin API routes.
 * Enforces requireAdmin() and supports:
 * 1. Logged-in Admin / Super Admin session cookie via requireAdmin()
 * 2. ADMIN_PASSWORD via header (x-admin-password or Authorization: Bearer <token>) when ADMIN_PASSWORD is set
 * 3. ADMIN_PASSWORD via query parameter (?password=<token>) when ADMIN_PASSWORD is set
 * 4. Fallback bookmark cookie (oak_partner_pass) if mapped to an active admin in admin_users
 * Non-admins receive 403 Forbidden.
 */
export async function verifyMeetingAdminAuth(request: Request): Promise<MeetingAdminAuthResult> {
  // 1. Primary check: Supabase admin session via requireAdmin()
  try {
    const adminAccess = await requireAdmin();
    if (!adminAccess.response) {
      const email = adminAccess.adminUser?.email || adminAccess.user?.email || "admin@oakfnd.org";
      return { authorized: true, adminEmail: email, status: 200 };
    }
    // If requireAdmin() explicitly returned 403 (logged-in non-admin user), deny with 403 immediately
    if (adminAccess.response.status === 403) {
      return { authorized: false, adminEmail: "", status: 403 };
    }
  } catch {
    // Continue to fallback checks
  }

  // 2. Check ADMIN_PASSWORD if configured in environment
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const authHeader = request.headers.get("x-admin-password") || request.headers.get("authorization");

  if (authHeader && adminPassword) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === adminPassword) {
      return { authorized: true, adminEmail: "admin@oakfnd.org", status: 200 };
    }
    return { authorized: false, adminEmail: "", status: 403 };
  }

  const url = new URL(request.url);
  const queryPassword = url.searchParams.get("password")?.trim();
  if (queryPassword && adminPassword) {
    if (queryPassword === adminPassword) {
      return { authorized: true, adminEmail: "admin@oakfnd.org", status: 200 };
    }
    return { authorized: false, adminEmail: "", status: 403 };
  }

  // 3. Check fallback session via cookie bookmark (oak_partner_pass) only if mapped to an active admin
  try {
    const cookieStore = await cookies();
    const bookmark = cookieStore.get("oak_partner_pass")?.value;
    if (bookmark && /^OAK-2026-\d{4}-[A-Z0-9]{4}$/i.test(bookmark)) {
      if (isSupabaseServerConfigured()) {
        const adminClient = createAdminClient();
        const { data: exists } = await adminClient
          .from("attendees")
          .select("email")
          .eq("event_code", bookmark.toUpperCase())
          .maybeSingle();

        if (exists?.email && isValidAdminEmailDomain(exists.email)) {
          const adminRecord = await getAdminUser(exists.email);
          if (adminRecord && adminRecord.is_active) {
            return { authorized: true, adminEmail: exists.email.toLowerCase().trim(), status: 200 };
          }
        }
        // Bookmark belongs to a non-admin attendee -> 403 Forbidden
        return { authorized: false, adminEmail: "", status: 403 };
      }
    }
  } catch {
    // Continue
  }

  return { authorized: false, adminEmail: "", status: 403 };
}
