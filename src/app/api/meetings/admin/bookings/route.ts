import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendCancellationEmails } from "@/lib/email";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { getDurableSyncStateMap, getMemorySyncState } from "@/lib/sheets/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized access. Please log in as staff or provide the admin password." },
      { status: auth.status || 401 }
    );
  }

  try {
    const admin = createAdminClient();
    const url = new URL(request.url);
    const advisorFilter = url.searchParams.get("advisor_id");

    const selectQuery = (withErrorCol: boolean, withSheetCols: boolean) => `
      id,
      name,
      email,
      organisation,
      message,
      status,
      email_status,
      ${withErrorCol ? "email_error," : ""}
      ${withSheetCols ? "cancelled_at, sheet_sync_status, sheet_sync_error, sheet_synced_at," : ""}
      cancel_token,
      created_at,
      slots:slot_id (
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
          email
        )
      )
    `;

    // Attempt with all optional columns, gracefully fallback if not migrated yet
    let { data: bookings, error } = await admin
      .from("bookings")
      .select(selectQuery(true, true))
      .order("created_at", { ascending: false });

    if (error && /sheet_sync_|cancelled_at|column|schema cache/i.test(error.message || "")) {
      const retry1 = await admin
        .from("bookings")
        .select(selectQuery(true, false))
        .order("created_at", { ascending: false });
      bookings = retry1.data as any;
      error = retry1.error;
    }

    if (error && /email_error|column|schema cache/i.test(error.message || "")) {
      const fallback = await admin
        .from("bookings")
        .select(selectQuery(false, false))
        .order("created_at", { ascending: false });
      bookings = (fallback.data || []).map((b: any) => ({ ...b, email_error: null })) as any;
      error = fallback.error;
    }

    if (error) {
      console.error("Error fetching admin bookings:", error);
      return NextResponse.json({ error: "Failed to load bookings" }, { status: 500 });
    }

    // Cancelled bookings stay in the database (audit trail, sheet sync) but are not listed or exported
    bookings = (bookings || []).filter((b: any) => b.status !== "cancelled") as typeof bookings;

    // Merge with durable queue/audit + in-memory sync fallback state and ensure defaults
    const durableStateMap = await getDurableSyncStateMap(admin);
    const enrichedBookings = (bookings || []).map((b: any) => {
      const mem = getMemorySyncState(b.id);
      const durable = durableStateMap.get(b.id);
      return {
        ...b,
        sheet_sync_status:
          b.sheet_sync_status ||
          durable?.sheet_sync_status ||
          mem?.sheet_sync_status ||
          "pending",
        sheet_sync_error:
          b.sheet_sync_error !== undefined
            ? b.sheet_sync_error
            : durable?.sheet_sync_error ?? mem?.sheet_sync_error ?? null,
        sheet_synced_at:
          b.sheet_synced_at || durable?.sheet_synced_at || mem?.sheet_synced_at || null,
        cancelled_at: b.cancelled_at || durable?.cancelled_at || mem?.cancelled_at || null,
        sheet_row_index: durable?.sheet_row_index ?? null,
        sync_attempts: durable?.attempts ?? 0,
      };
    });

    // Filter by advisor if specified
    const filteredBookings = enrichedBookings.filter((b: any) => {
      if (!advisorFilter) return true;
      const slot = Array.isArray(b.slots) ? b.slots[0] : b.slots;
      return slot?.advisor_id === advisorFilter;
    });

    // Show bookings in meeting order (earliest day and time first) so advisers see their day in sequence.
    type SortSlot = { start_time?: string | null; advisors?: { full_name?: string | null } | { full_name?: string | null }[] | null };
    type Sortable = { slots?: SortSlot | SortSlot[] | null };
    const slotOf = (b: Sortable) => (Array.isArray(b.slots) ? b.slots[0] : b.slots);
    const slotStart = (b: Sortable) => {
      const start = slotOf(b)?.start_time;
      const t = start ? Date.parse(start) : NaN;
      return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    };
    const advisorName = (b: Sortable) => {
      const adv = slotOf(b)?.advisors;
      return (Array.isArray(adv) ? adv[0] : adv)?.full_name || "";
    };
    filteredBookings.sort((a: Sortable, b: Sortable) => slotStart(a) - slotStart(b) || advisorName(a).localeCompare(advisorName(b)));

    const isCsv = url.searchParams.get("format") === "csv";

    if (isCsv) {
      const headers = ["Advisor", "Slot Date", "Slot Time", "Duration", "Note", "Name", "Email", "Organisation", "Description", "Status", "Email Status", "Booked At"];
      const rows = filteredBookings.map((b: any) => {
        const slot = Array.isArray(b.slots) ? b.slots[0] : b.slots;
        const advisor = slot?.advisors ? (Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors) : null;
        const startDate = slot?.start_time ? new Date(slot.start_time) : null;
        const endDate = slot?.end_time ? new Date(slot.end_time) : null;

        const dateStr = startDate ? startDate.toLocaleDateString("en-GB", { timeZone: "Africa/Harare" }) : "";
        const timeStr = startDate && endDate
          ? `${startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Harare" })} - ${endDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Harare" })}`
          : "";

        return [
          advisor?.full_name || "Silvia Guizzardi",
          dateStr,
          timeStr,
          slot ? `${slot.duration_minutes} min` : "",
          slot?.note || "",
          b.name,
          b.email,
          b.organisation,
          `"${(b.message || "").replace(/"/g, '""')}"`,
          b.status,
          b.email_status,
          new Date(b.created_at).toISOString(),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="oak-clinic-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ bookings: filteredBookings });
  } catch (err) {
    console.error("Unexpected error in admin bookings GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
