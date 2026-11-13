import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    const url = new URL(request.url);
    const advisorId = url.searchParams.get("advisor_id");
    const slug = url.searchParams.get("slug");

    // 1. Resolve advisor if filtered by slug
    let targetAdvisorId = advisorId;
    let selectedAdvisor = null;

    if (slug) {
      const { data: adv } = await admin
        .from("advisors")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (adv) {
        targetAdvisorId = adv.id;
        selectedAdvisor = adv;
      }
    } else if (advisorId) {
      const { data: adv } = await admin
        .from("advisors")
        .select("*")
        .eq("id", advisorId)
        .maybeSingle();
      if (adv) {
        selectedAdvisor = adv;
      }
    }

    // 2. Query slots
    let slotsQuery = admin
      .from("slots")
      .select(`
        id,
        advisor_id,
        start_time,
        end_time,
        duration_minutes,
        note,
        advisors:advisor_id (
          id,
          slug,
          full_name,
          job_title,
          photo_url,
          email,
          is_active
        )
      `)
      .order("start_time", { ascending: true });

    if (targetAdvisorId) {
      slotsQuery = slotsQuery.eq("advisor_id", targetAdvisorId);
    }

    // Slots that have already started can't be booked, so don't offer them
    slotsQuery = slotsQuery.gt("start_time", new Date().toISOString());

    const { data: slots, error: slotsError } = await slotsQuery;

    if (slotsError) {
      console.error("Error fetching slots:", slotsError);
      return NextResponse.json({ error: "Failed to load slots" }, { status: 500 });
    }

    // 3. Query all active (confirmed) bookings
    const { data: activeBookings, error: bookingsError } = await admin
      .from("bookings")
      .select("slot_id")
      .eq("status", "confirmed");

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      return NextResponse.json({ error: "Failed to verify slot availability" }, { status: 500 });
    }

    const bookedSlotIds = new Set((activeBookings || []).map((b) => b.slot_id));

    // 4. Map slots with status
    const slotsWithStatus = (slots || []).map((slot) => {
      const advisor = Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors;
      return {
        ...slot,
        advisor,
        is_booked: bookedSlotIds.has(slot.id),
      };
    });

    return NextResponse.json({
      slots: slotsWithStatus,
      advisor: selectedAdvisor,
    });
  } catch (err) {
    console.error("Unexpected error in /api/meetings/slots:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
