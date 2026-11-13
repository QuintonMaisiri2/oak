import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { isEmailVerified, isValidAdminEmailDomain } from "@/lib/auth/policy";
import {
  isExactOakStaffDomain,
  isExplicitlyAllowlistedEmail,
  isGoogleEmailVerified,
  normalizeEmail,
} from "@/lib/auth/allowlist";
import { getAdminUser } from "@/lib/auth/admin-users";

export async function GET() {
  let isStaff = false;
  let isSuperAdmin = false;
  let isOakStaff = false;
  let adminRole: "super_admin" | "admin" | null = null;
  let adminTeam: string | null = null;
  let partnerId: string | null = null;
  let attendeeInfo: { name: string; email: string; organization: string } | null = null;

  if (isSupabaseServerConfigured()) {
    try {
      const client = await createClient();
      const {
        data: { user },
        error,
      } = await client.auth.getUser();

      if (!error && user && user.email) {
        const email = normalizeEmail(user.email);
        const emailVerified = isGoogleEmailVerified(user) || isEmailVerified(user);
        const domainAllowed = isValidAdminEmailDomain(email);

        if (emailVerified && domainAllowed) {
          const adminRecord = await getAdminUser(email);
          if (adminRecord && adminRecord.is_active) {
            isStaff = true;
            isSuperAdmin = adminRecord.role === "super_admin";
            adminRole = adminRecord.role;
            adminTeam = adminRecord.team;
          }
        }

        if (emailVerified && (isExactOakStaffDomain(email) || isExplicitlyAllowlistedEmail(email))) {
          isOakStaff = true;
        }

        // Check if the authenticated user has an attendee record
        const adminClient = createAdminClient();
        const { data: attendee } = await adminClient
          .from("attendees")
          .select("event_code, first_name, last_name, email, organization")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (attendee?.event_code && normalizeEmail(attendee.email) === email) {
          partnerId = attendee.event_code;
          const fullName = [attendee.first_name, attendee.last_name].filter(Boolean).join(" ").trim();
          attendeeInfo = {
            name: fullName,
            email: normalizeEmail(attendee.email) || email,
            organization:
              attendee.organization ||
              (isOakStaff || adminTeam === "OAK"
                ? "OAK Foundation"
                : isStaff
                ? "Coordination Team"
                : ""),
          };
        } else if (isStaff || isOakStaff) {
          const staffName = (
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            email.split("@")[0].replace(/[._-]+/g, " ")
          ).trim();
          attendeeInfo = {
            name: staffName,
            email,
            organization:
              isOakStaff || adminTeam === "OAK"
                ? "OAK Foundation"
                : "Uncommon / Coordination Team",
          };
        }
      }
    } catch (err) {
      console.error("Error in session user lookup:", err);
    }
  }

  // Fallback to cookie bookmark if not resolved via authenticated user
  if (!partnerId) {
    try {
      const cookieStore = await cookies();
      const bookmark = cookieStore.get("oak_partner_pass")?.value;

      if (bookmark && /^OAK-2026-\d{4}-[A-Z0-9]{4}$/i.test(bookmark)) {
        if (isSupabaseServerConfigured()) {
          const adminClient = createAdminClient();
          const { data: exists } = await adminClient
            .from("attendees")
            .select("id, event_code, first_name, last_name, email, organization, role")
            .eq("event_code", bookmark.toUpperCase())
            .maybeSingle();

          if (exists) {
            const normalizedExistsEmail = normalizeEmail(exists.email);
            partnerId = bookmark;
            const fullName = [exists.first_name, exists.last_name].filter(Boolean).join(" ").trim();
            attendeeInfo = {
              name: fullName,
              email: normalizedExistsEmail,
              organization: exists.organization || "",
            };
            if (normalizedExistsEmail && isValidAdminEmailDomain(normalizedExistsEmail)) {
              const adminRecord = await getAdminUser(normalizedExistsEmail);
              if (adminRecord && adminRecord.is_active) {
                isStaff = true;
                isSuperAdmin = adminRecord.role === "super_admin";
                adminRole = adminRecord.role;
                adminTeam = adminRecord.team;
              }
            }
          }
        } else {
          partnerId = bookmark;
        }
      }
    } catch (err) {
      console.error("Error in session cookie fallback:", err);
    }
  }

  const isRegistered = Boolean(partnerId || isStaff || isOakStaff);

  return NextResponse.json(
    {
      isStaff,
      isSuperAdmin,
      isOakStaff,
      adminRole,
      adminTeam,
      partnerId,
      isRegistered,
      attendee: attendeeInfo,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
