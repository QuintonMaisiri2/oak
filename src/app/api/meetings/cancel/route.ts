import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendCancellationEmails } from "@/lib/email";
import { recordMemoryCancelledAt, syncBookingToSheetById } from "@/lib/sheets/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = (url.searchParams.get("token") || "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing cancellation token" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: booking, error } = await admin
      .from("bookings")
      .select(`
        id,
        name,
        email,
        organisation,
        message,
        status,
        slots:slot_id (
          id,
          start_time,
          end_time,
          duration_minutes,
          note,
          advisors:advisor_id (
            id,
            full_name,
            job_title,
            email
          )
        )
      `)
      .eq("cancel_token", token)
      .maybeSingle();

    if (error) {
      console.error("[CANCEL GET ERROR]:", error);
      return NextResponse.json({ error: "Database error: " + error.message }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Invalid or expired cancellation link." }, { status: 404 });
    }

    const slot = Array.isArray(booking.slots) ? booking.slots[0] : booking.slots;
    const advisor = slot?.advisors ? (Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors) : null;

    return NextResponse.json({
      booking: {
        id: booking.id,
        name: booking.name,
        email: booking.email,
        organisation: booking.organisation,
        status: booking.status,
        slot_time: slot ? `${slot.start_time}` : "",
        advisor_name: advisor?.full_name || "OAK Advisor",
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/meetings/cancel:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let token = "";
    try {
      const body = await request.json();
      token = (body.token || "").trim();
    } catch {
      // Body may not be valid JSON, check URL
    }

    if (!token) {
      const url = new URL(request.url);
      token = (url.searchParams.get("token") || "").trim();
    }

    if (!token) {
      return NextResponse.json({ error: "Missing cancellation token" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch booking with slot and advisor
    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select(`
        id,
        name,
        email,
        organisation,
        message,
        status,
        email_status,
        created_at,
        slots:slot_id (
          id,
          start_time,
          end_time,
          duration_minutes,
          note,
          advisors:advisor_id (
            id,
            full_name,
            email
          )
        )
      `)
      .eq("cancel_token", token)
      .maybeSingle();

    if (fetchErr) {
      console.error("[CANCEL POST FETCH ERROR]:", fetchErr);
      return NextResponse.json(
        { error: "Database error retrieving booking: " + fetchErr.message },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found or already cancelled." }, { status: 404 });
    }

    // Idempotent: already cancelled
    if (booking.status === "cancelled") {
      return NextResponse.json({
        success: true,
        message: "This booking has already been cancelled. The slot has been freed.",
        alreadyCancelled: true,
      });
    }

    // 2. Mark booking as cancelled
    // Thanks to the partial unique index on status = 'confirmed', marking as cancelled immediately frees the slot!
    const cancelledAtIso = new Date().toISOString();
    recordMemoryCancelledAt(booking.id, cancelledAtIso);

    let { error: updateErr } = await admin
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: cancelledAtIso })
      .eq("id", booking.id);

    if (updateErr && /cancelled_at|column|schema cache/i.test(updateErr.message || "")) {
      const retry = await admin
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", booking.id);
      updateErr = retry.error;
    }

    if (updateErr) {
      console.error("Error updating booking to cancelled:", updateErr);
      return NextResponse.json(
        { error: "Failed to cancel booking: " + updateErr.message },
        { status: 500 }
      );
    }

    const slot = Array.isArray(booking.slots) ? booking.slots[0] : booking.slots;
    const advisor = slot?.advisors ? (Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors) : null;

    const startDate = slot?.start_time ? new Date(slot.start_time) : new Date();
    const dateFormatted = startDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Harare",
    });
    const timeFormatted = startDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Harare",
    });

    // 3. Dispatch cancellation emails (awaited, with error safety)
    try {
      await sendCancellationEmails({
        slotDate: dateFormatted,
        slotTime: timeFormatted,
        bookerName: booking.name,
        bookerEmail: booking.email,
        organisation: booking.organisation,
        advisorName: advisor?.full_name || "Silvia Guizzardi",
        advisorEmail: advisor?.email || "silvia.guizzardi@oakfnd.ch",
      });
    } catch (emailErr) {
      console.error("[CANCEL EMAIL FAILED]", emailErr);
    }

    // 4. Sync cancelled status to Google Sheet (awaited, never blocks or rolls back cancellation)
    await syncBookingToSheetById(admin, booking.id, {
      bookingOverride: {
        ...booking,
        status: "cancelled",
        cancelled_at: cancelledAtIso,
      },
    });

    return NextResponse.json({ success: true, message: "Booking cancelled successfully and slot freed." });
  } catch (err: any) {
    console.error("Error in POST /api/meetings/cancel:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
