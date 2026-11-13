import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendBookingEmails, updateBookingEmailRecord } from "@/lib/email";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { syncBookingToSheetById } from "@/lib/sheets/sync";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: auth.status || 401 });
  }

  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select(`
        id,
        name,
        email,
        organisation,
        message,
        cancel_token,
        status,
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
            job_title,
            email
          )
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const slot = Array.isArray(booking.slots) ? booking.slots[0] : booking.slots;
    const advisor = slot?.advisors ? (Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors) : null;

    if (!slot) {
      return NextResponse.json({ error: "Slot data missing for booking" }, { status: 400 });
    }

    const startDate = new Date(slot.start_time);
    const dateFormatted = startDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Harare",
    });
    const startTimeFormatted = startDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Harare",
    });
    const endTimeFormatted = new Date(slot.end_time).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Harare",
    });

    const res = await sendBookingEmails({
      bookingId: booking.id,
      slotDate: dateFormatted,
      slotTime: `${startTimeFormatted} - ${endTimeFormatted}`,
      durationMinutes: slot.duration_minutes,
      note: slot.note,
      startTimeIso: slot.start_time,
      endTimeIso: slot.end_time,
      bookerName: booking.name,
      bookerEmail: booking.email,
      organisation: booking.organisation,
      message: booking.message,
      advisorName: advisor?.full_name || "Silvia Guizzardi",
      advisorTitle: advisor?.job_title || "Senior Adviser for Impact",
      advisorEmail: advisor?.email || "silvia.guizzardi@oakfnd.ch",
      cancelToken: booking.cancel_token,
    });

    await updateBookingEmailRecord(admin, booking.id, res.status, res.error);

    // Sync updated emailStatus to Google Sheet (awaited, never blocks or rolls back)
    const sheetSync = await syncBookingToSheetById(admin, booking.id, {
      bookingOverride: {
        ...booking,
        email_status: res.status,
      },
    });

    return NextResponse.json({
      success: res.success,
      email_status: res.status,
      error: res.error || null,
      sheet_sync_status: sheetSync.status,
      sheet_sync_error: sheetSync.error,
      sheet_synced_at: sheetSync.syncedAt,
      advisorResult: res.advisorResult,
      bookerResult: res.bookerResult,
    });
  } catch (err: any) {
    console.error("Error in resend email route:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
