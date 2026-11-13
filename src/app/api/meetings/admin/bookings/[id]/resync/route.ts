import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { logAuditEvent } from "@/lib/audit";
import { syncBookingToSheetById } from "@/lib/sheets/sync";

/**
 * POST /api/meetings/admin/bookings/[id]/resync
 * Re-syncs a single booking row to the Google Sheet webhook.
 * Protected by requireAdmin() and recorded in the audit log.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    let actorEmail = adminCheck.adminUser?.email || adminCheck.user?.email || "";

    if (adminCheck.response) {
      if (adminCheck.response.status === 403) {
        return adminCheck.response;
      }
      const fallbackAuth = await verifyMeetingAdminAuth(request);
      if (!fallbackAuth.authorized) {
        return NextResponse.json(
          { error: "Forbidden — Admin access required" },
          { status: fallbackAuth.status || 403 }
        );
      }
      actorEmail = fallbackAuth.adminEmail;
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
    }

    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const admin = createAdminClient();
    const syncResult = await syncBookingToSheetById(admin, id);

    await logAuditEvent({
      action: "booking_sheet_resync",
      actor_email: actorEmail,
      details: {
        booking_id: id,
        sheet_sync_status: syncResult.status,
        sheet_sync_error: syncResult.error,
      },
    });

    if (!syncResult.ok && syncResult.error === "Booking not found") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: syncResult.ok,
      sheet_sync_status: syncResult.status,
      sheet_sync_error: syncResult.error,
      sheet_synced_at: syncResult.syncedAt,
    });
  } catch (err: any) {
    console.error("[admin/bookings/resync] Unexpected error:", err?.message || "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
