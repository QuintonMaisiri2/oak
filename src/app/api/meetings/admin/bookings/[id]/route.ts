import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendCancellationEmails } from "@/lib/email";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { logAuditEvent } from "@/lib/audit";
import { recordMemoryCancelledAt, syncBookingToSheetById } from "@/lib/sheets/sync";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized access. Please log in as staff or provide the admin password." },
      { status: auth.status || 401 }
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
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
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      console.error("[CANCEL BOOKING FETCH ERROR]:", fetchErr);
      return NextResponse.json(
        { error: "Failed to look up booking: " + fetchErr.message },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Idempotent: if already cancelled, treat as success
    if (booking.status === "cancelled") {
      return NextResponse.json({
        success: true,
        message: "Booking is already cancelled. Slot is available.",
        alreadyCancelled: true,
      });
    }

    // 2. Mark booking as cancelled (frees the slot)
    const cancelledAtIso = new Date().toISOString();
    recordMemoryCancelledAt(id, cancelledAtIso);

    let { error: updateErr } = await admin
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: cancelledAtIso })
      .eq("id", id);

    if (updateErr && /cancelled_at|column|schema cache/i.test(updateErr.message || "")) {
      const retry = await admin
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id);
      updateErr = retry.error;
    }

    if (updateErr) {
      console.error("[CANCEL BOOKING UPDATE ERROR]:", updateErr);
      return NextResponse.json(
        { error: "Database error cancelling booking: " + updateErr.message },
        { status: 500 }
      );
    }

    // 3. Log audit event
    try {
      await logAuditEvent({
        action: "booking_cancelled",
        actor_email: auth.adminEmail || "admin@oakfnd.org",
        target_email: booking.email,
        details: {
          booking_id: id,
          attendee_name: booking.name,
          organisation: booking.organisation,
        },
      });
    } catch (auditErr) {
      console.warn("Could not log audit event for booking cancellation:", auditErr);
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

    // 4. Send cancellation emails to both parties (awaited with error safety)
    await sendCancellationEmails({
      slotDate: dateFormatted,
      slotTime: timeFormatted,
      bookerName: booking.name,
      bookerEmail: booking.email,
      organisation: booking.organisation,
      advisorName: advisor?.full_name || "Silvia Guizzardi",
      advisorEmail: advisor?.email || "silvia.guizzardi@oakfnd.ch",
    }).catch((err) => console.error("Cancellation email send error:", err));

    // 5. Sync cancelled booking to Google Sheet (awaited, never blocks or rolls back cancellation)
    const sheetSync = await syncBookingToSheetById(admin, id, {
      bookingOverride: {
        ...booking,
        status: "cancelled",
        cancelled_at: cancelledAtIso,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Booking cancelled and slot freed",
      sheet_sync_status: sheetSync.status,
      sheet_sync_error: sheetSync.error,
    });
  } catch (err: any) {
    console.error("Unexpected error in booking DELETE:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return DELETE(request, context);
}
