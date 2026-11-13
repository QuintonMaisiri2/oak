import { cookies } from "next/headers";
import { createAdminClient, createClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/allowlist";
import { PASS_ACCESS_COOKIE, verifyPassAccess } from "@/lib/auth/pass-access";

/**
 * Resolves the email of the person making a request from server-verified state only:
 * 1. a Supabase session (Google sign-in or email code), or
 * 2. the HMAC-signed pass cookie set after registration / sign-in.
 * Never trusts an email supplied in the request body.
 */
export async function getVerifiedRequesterEmail(): Promise<string | null> {
  if (isSupabaseServerConfigured()) {
    try {
      const client = await createClient();
      const { data: { user } } = await client.auth.getUser();
      if (user?.email) return normalizeEmail(user.email);
    } catch (err) {
      console.warn("[booking-identity] Session lookup failed:", err);
    }
  }

  const token = (await cookies()).get(PASS_ACCESS_COOKIE)?.value;
  const eventCode = token?.split(".")[0];
  if (!token || !eventCode || !verifyPassAccess(token, eventCode)) return null;

  const { data } = await createAdminClient()
    .from("attendees")
    .select("email")
    .eq("event_code", eventCode)
    .maybeSingle();
  return data?.email ? normalizeEmail(data.email) : null;
}
