import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { sendBookingEmails, updateBookingEmailRecord } from "@/lib/email";
import { isValidAdminEmailDomain } from "@/lib/auth/policy";
import { syncBookingToSheetById } from "@/lib/sheets/sync";
import { getVerifiedRequesterEmail } from "@/lib/auth/booking-identity";

const bookingSchema = z.object({
  slot_id: z.string().uuid("Invalid slot ID"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  // Ignored: the booking is always made under the signed-in person's verified email.
  email: z.string().optional(),
  organisation: z.string().trim().min(2, "Organisation must be at least 2 characters").max(150, "Organisation name is too long"),
  message: z.string().trim().min(5, "Please provide a brief description (at least 5 characters)").max(500, "Description cannot exceed 500 characters"),
});

type ExistingSlot = { start_time: string; advisors?: { full_name: string } | { full_name: string }[] | null };

function alreadyBookedMessage(slots: ExistingSlot | ExistingSlot[] | null | undefined) {
  const slot = Array.isArray(slots) ? slots[0] : slots;
  const advisor = slot ? (Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors) : null;
  const detail = slot
    ? ` with ${advisor?.full_name || "an adviser"} (${new Date(slot.start_time).toLocaleString("en-GB", {
        weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Harare",
      })})`
    : "";
  return `You already have a meeting${detail}. Each person can book one meeting only. To change it, cancel it first using the link in your confirmation email.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = bookingSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Validation failed";
      return NextResponse.json({ error: firstError, details: parseResult.error.flatten() }, { status: 400 });
    }

    const { slot_id, name, organisation, message } = parseResult.data;
    const admin = createAdminClient();

    // 0. Bookings are tied to the signed-in person, not to whatever email is typed in the form
    const email = await getVerifiedRequesterEmail();
    if (!email) {
      return NextResponse.json(
        { error: "Please sign in with your registered email to book a meeting." },
        { status: 401 }
      );
    }

    // 1. Verify that the booker is an existing registered attendee or staff
    const isStaffEmail = isValidAdminEmailDomain(email);
    const { data: registeredAttendee } = await admin
      .from("attendees")
      .select("id, first_name, last_name, email, organization")
      .ilike("email", email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!registeredAttendee && !isStaffEmail) {
      return NextResponse.json(
        {
          error: `Only registered event attendees can book 1:1 meetings. The email "${email}" was not found in the attendee directory. Please register for the event first.`,
        },
        { status: 403 }
      );
    }

    // 2. Fetch slot with its linked advisor
    const { data: slot, error: slotError } = await admin
      .from("slots")
      .select(`
        id,
        start_time,
        end_time,
        duration_minutes,
        note,
        advisor_id,
        advisors:advisor_id (
          id,
          full_name,
          job_title,
          email
        )
      `)
      .eq("id", slot_id)
      .maybeSingle();

    if (slotError || !slot) {
      return NextResponse.json({ error: "Selected slot does not exist." }, { status: 404 });
    }

    // 2a. Past slots can no longer be booked
    if (new Date(slot.start_time).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This slot has already started or passed. Please choose a later time." }, { status: 410 });
    }

    // 2b. One confirmed booking per person in total, across all advisers.
    // (The idx_bookings_one_per_person unique index enforces this in the database too.)
    const { data: existingBooking } = await admin
      .from("bookings")
      .select(`id, slots:slot_id ( start_time, advisors:advisor_id ( full_name ) )`)
      .eq("email", email.toLowerCase())
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json({ error: alreadyBookedMessage(existingBooking.slots) }, { status: 409 });
    }

    // Resolve advisor (defaults to Silvia if not linked)
    let advisor = Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors;
    if (!advisor) {
      const { data: fallbackAdvisor } = await admin
        .from("advisors")
        .select("id, full_name, job_title, email")
        .eq("slug", "silvia-guizzardi")
        .maybeSingle();
      advisor = fallbackAdvisor || {
        id: "silvia-guizzardi",
        full_name: "Silvia Guizzardi",
        job_title: "Senior Adviser for Impact",
        email: "silvia.guizzardi@oakfnd.ch",
      };
    }

    // 3. Generate secure random cancel token
    const cancelToken = crypto.randomBytes(24).toString("hex");

    // 4. Insert booking atomically
    // The partial unique index on status = 'confirmed' guarantees that no two active bookings can share slot_id
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        slot_id,
        name,
        email: email.toLowerCase(),
        organisation,
        message,
        cancel_token: cancelToken,
        status: "confirmed",
        email_status: "pending",
      })
      .select()
      .single();

    if (bookingError) {
      // 23505 = unique_violation code
      if (bookingError.code === "23505" && bookingError.message?.includes("idx_bookings_one_per_person")) {
        // Two booking requests from the same person raced past the check above
        return NextResponse.json({ error: alreadyBookedMessage(null) }, { status: 409 });
      }
      if (bookingError.code === "23505" || bookingError.message?.includes("duplicate key")) {
        return NextResponse.json(
          { error: "Sorry, that slot was just taken. Please choose another." },
          { status: 409 }
        );
      }

      console.error("Database error creating booking:", bookingError);
      return NextResponse.json(
        { error: "Failed to complete booking. Please try again." },
        { status: 500 }
      );
    }

    // 5. Format times for response and emails
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
    const timeFormatted = `${startTimeFormatted} - ${endTimeFormatted}`;

    // 6. Send emails server-side (advisor + booker with .ics)
    const emailResult = await sendBookingEmails({
      bookingId: booking.id,
      slotDate: dateFormatted,
      slotTime: timeFormatted,
      durationMinutes: slot.duration_minutes,
      note: slot.note,
      startTimeIso: slot.start_time,
      endTimeIso: slot.end_time,
      bookerName: name,
      bookerEmail: email,
      organisation,
      message,
      advisorName: advisor.full_name,
      advisorTitle: advisor.job_title,
      advisorEmail: advisor.email,
      cancelToken,
    });

    // 7. Update booking record with email_status and email_error
    await updateBookingEmailRecord(admin, booking.id, emailResult.status, emailResult.error);

    // 8. Sync booking to Google Sheet (awaited, never blocks or rolls back booking on failure)
    const sheetSync = await syncBookingToSheetById(admin, booking.id, {
      bookingOverride: {
        ...booking,
        email_status: emailResult.status,
        slots: {
          ...slot,
          advisors: advisor,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        booking: {
          id: booking.id,
          slot_id: slot.id,
          date: dateFormatted,
          time: timeFormatted,
          duration: `${slot.duration_minutes} min`,
          note: slot.note,
          name,
          email,
          organisation,
          message,
          advisor_name: advisor.full_name,
          advisor_title: advisor.job_title,
          cancel_token: cancelToken,
          email_status: emailResult.status,
          sheet_sync_status: sheetSync.status,
          created_at: booking.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected error in /api/meetings/book:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
