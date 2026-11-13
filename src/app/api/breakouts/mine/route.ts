import { NextRequest, NextResponse } from "next/server";
import { canAccessDirectory } from "@/lib/auth/directory-access";
import { createAdminClient } from "@/lib/supabase/server";
import { findMyBreakout, getBreakoutGroups } from "@/lib/breakouts";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const EVENT_CODE = /^OAK-2026-\d{4}-[A-Z0-9]{4}$/i;

/** GET /api/breakouts/mine?id=<registration id> — the breakout group for one attendee's pass. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!UUID.test(id) && !EVENT_CODE.test(id)) {
    return NextResponse.json({ error: "Invalid attendee identifier" }, { status: 400 });
  }
  // Same rule as the /breakouts page: registered attendees and staff only.
  if (!(await canAccessDirectory())) {
    return NextResponse.json({ error: "Sign in to see your breakout group" }, { status: 401 });
  }

  const query = createAdminClient().from("attendees").select("first_name,last_name,organization");
  const { data: attendee, error } = await (UUID.test(id) ? query.eq("id", id) : query.eq("event_code", id.toUpperCase())).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load attendee" }, { status: 500 });
  if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

  const { rounds, groups } = await getBreakoutGroups();
  const mine = findMyBreakout(groups, {
    firstName: attendee.first_name ?? "",
    lastName: attendee.last_name ?? "",
    organisation: attendee.organization,
  });

  return NextResponse.json({
    group: mine
      ? {
          name: mine.group.name,
          memberCount: mine.group.members.length,
          sessions: rounds.map((round, r) => ({ label: round.label, time: round.time, session: mine.group.sessions[r] || "" })),
        }
      : null,
  });
}
