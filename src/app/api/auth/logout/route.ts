import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AUTH_COOKIE_OPTIONS, isSameOrigin } from "@/lib/auth/policy";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const client = await createClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    const store = await cookies();
    const cookiesToClear = [
      "oak_role",
      "oak_admin_session",
      "oak_admin_email",
      "oak_partner_pass",
      "oak_pass_access",
      "oak_attendee_email",
    ];
    for (const { name } of store.getAll()) {
      if (/^sb-.*-auth-token/.test(name) || cookiesToClear.includes(name)) {
        store.set(name, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
      }
    }
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Sign out failed:", error);
    return NextResponse.json({ error: "Unable to sign out. Please try again." }, { status: 503 });
  }
}
