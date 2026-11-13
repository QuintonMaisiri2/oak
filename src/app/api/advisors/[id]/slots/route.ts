import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    // Verify advisor exists
    const { data: advisor, error: advErr } = await admin
      .from("advisors")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (advErr || !advisor) {
      return NextResponse.json({ error: "Advisor not found" }, { status: 404 });
    }

    // Body can be an array of slot objects or single slot object
    const slotsInput = Array.isArray(body) ? body : [body];

    const recordsToInsert = slotsInput.map((s: any) => {
      if (!s.start_time || !s.end_time || !s.duration_minutes) {
        throw new Error("Each slot requires start_time, end_time, and duration_minutes");
      }
      return {
        advisor_id: id,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_minutes: Number(s.duration_minutes),
        note: s.note?.trim() || null,
      };
    });

    const { data: inserted, error: insertErr } = await admin
      .from("slots")
      .insert(recordsToInsert)
      .select();

    if (insertErr) {
      console.error("Error bulk adding slots:", insertErr);
      return NextResponse.json({ error: insertErr.message || "Failed to add slots" }, { status: 400 });
    }

    return NextResponse.json({ success: true, count: inserted?.length || 0, slots: inserted }, { status: 201 });
  } catch (err: any) {
    console.error("Unexpected error in bulk adding slots:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
