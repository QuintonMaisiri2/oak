import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    const url = new URL(request.url);
    const auth = await verifyMeetingAdminAuth(request);
    const includeInactive = url.searchParams.get("all") === "true" && auth.authorized;

    let query = admin.from("advisors").select("*").order("created_at", { ascending: true });
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data: advisors, error } = await query;

    if (error) {
      console.error("Error fetching advisors:", error);
      return NextResponse.json({ error: "Failed to load advisors" }, { status: 500 });
    }

    // Also get active slot counts for each advisor
    const { data: slots } = await admin
      .from("slots")
      .select("id, advisor_id");

    const { data: activeBookings } = await admin
      .from("bookings")
      .select("slot_id")
      .eq("status", "confirmed");

    const bookedSlotIds = new Set((activeBookings || []).map((b) => b.slot_id));

    const advisorsWithSlotCounts = (advisors || []).map((adv) => {
      const advSlots = (slots || []).filter((s) => s.advisor_id === adv.id);
      const availableCount = advSlots.filter((s) => !bookedSlotIds.has(s.id)).length;
      return {
        ...adv,
        total_slots: advSlots.length,
        available_slots: availableCount,
      };
    });

    return NextResponse.json({ advisors: advisorsWithSlotCounts });
  } catch (err) {
    console.error("Unexpected error in /api/advisors:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { full_name, job_title, bio, email, photo_url, is_active } = body;

    if (!full_name || !job_title || !bio || !email) {
      return NextResponse.json({ error: "Name, job title, bio, and email are required." }, { status: 400 });
    }

    // Generate clean slug from name
    const slug = body.slug || full_name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const admin = createAdminClient();
    const { data: advisor, error } = await admin
      .from("advisors")
      .insert({
        slug,
        full_name: full_name.trim(),
        job_title: job_title.trim(),
        bio: bio.trim(),
        email: email.trim().toLowerCase(),
        photo_url: photo_url?.trim() || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating advisor:", error);
      return NextResponse.json({ error: error.message || "Failed to create advisor" }, { status: 400 });
    }

    return NextResponse.json({ success: true, advisor }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST /api/advisors:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
