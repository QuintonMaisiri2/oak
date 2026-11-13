import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { logAuditEvent } from "@/lib/audit";
import { syncAllBookingsToSheet } from "@/lib/sheets/sync";

/**
 * POST /api/meetings/admin/bookings/sync-all
 * Backfills and resyncs all bookings to the Google Sheet in batches of 50.
 * Protected by requireAdmin() and recorded in the audit log.
 */
export async function POST(request: Request) {
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

    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const admin = createAdminClient();
    const bulkResult = await syncAllBookingsToSheet(admin);

    await logAuditEvent({
      action: "bookings_sheet_sync_all",
      actor_email: actorEmail,
      details: {
        total: bulkResult.total,
        succeeded: bulkResult.succeeded,
        failed: bulkResult.failed,
        batches: bulkResult.batches,
        ok: bulkResult.ok,
        error: bulkResult.error,
      },
    });

    return NextResponse.json({
      ok: bulkResult.ok,
      total: bulkResult.total,
      succeeded: bulkResult.succeeded,
      failed: bulkResult.failed,
      batches: bulkResult.batches,
      error: bulkResult.error,
    });
  } catch (err: any) {
    console.error("[admin/bookings/sync-all] Unexpected error:", err?.message || "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
