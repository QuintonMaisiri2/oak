import { cookies } from "next/headers";
import { createClient, createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { isStaffUserAsync } from "@/lib/auth/policy";

/**
 * Access gate for the Grantee Directory.
 * Accessible ONLY to:
 * 1. Logged in staff/admin members.
 * 2. Registered attendees (authenticated via Google OAuth or with valid pass cookies).
 */
export async function canAccessDirectory(): Promise<boolean> {
  // 1. Check if user is logged in via Supabase Auth
  if (isSupabaseServerConfigured()) {
    try {
      const client = await createClient();
      const { data: { user }, error } = await client.auth.getUser();
      if (!error && user && user.email) {
        const isStaff = await isStaffUserAsync(user);
        if (isStaff) return true;

        // Check if user is a registered attendee in attendees table
        const adminClient = createAdminClient();
        const { data: attendee } = await adminClient
          .from("attendees")
          .select("id")
          .ilike("email", user.email.toLowerCase().trim())
          .maybeSingle();

        if (attendee) return true;
      }
    } catch {
      // Continue to check registration cookies
    }
  }

  // 2. Check if user has oak_partner_pass bookmark or pass access token
  const cookieStore = await cookies();
  const bookmark = cookieStore.get("oak_partner_pass")?.value;
  if (bookmark && /^OAK-2026-\d{4}-[A-Z0-9]{4}$/i.test(bookmark)) {
    if (isSupabaseServerConfigured()) {
      try {
        const adminClient = createAdminClient();
        const { data: exists } = await adminClient
          .from("attendees")
          .select("id")
          .eq("event_code", bookmark.toUpperCase())
          .maybeSingle();
        if (exists) return true;
      } catch {
        return true;
      }
    } else {
      return true;
    }
  }

  const passAccess = cookieStore.get("oak_pass_access")?.value;
  if (passAccess) {
    return true;
  }

  return false;
}
