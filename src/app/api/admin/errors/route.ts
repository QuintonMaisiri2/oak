import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { listErrorLogs, resolveErrorLogs } from "@/lib/error-log";
import { listSheetSyncQueue, processSheetSyncQueue } from "@/lib/sheets/sync";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function authorizeSuperAdminOrHeader(request: Request): Promise<{
  authorized: boolean;
  actorEmail: string;
  response?: NextResponse;
}> {
  const superCheck = await requireSuperAdmin();
  if (!superCheck.response) {
    return {
      authorized: true,
      actorEmail: superCheck.adminUser?.email || superCheck.user?.email || "superadmin",
    };
  }

  const fallback = await verifyMeetingAdminAuth(request);
  if (fallback.authorized) {
    return {
      authorized: true,
      actorEmail: fallback.adminEmail || "superadmin",
    };
  }

  return {
    authorized: false,
    actorEmail: "",
    response: superCheck.response,
  };
}

/**
 * GET /api/admin/errors
 * Returns unresolved error_log entries and sheet_sync_queue status for the Super Admin Dashboard alert.
 */
export async function GET(request: Request) {
  try {
    const auth = await authorizeSuperAdminOrHeader(request);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const admin = createAdminClient();
    const url = new URL(request.url);
    if (url.searchParams.get("processDue") === "true") {
      await processSheetSyncQueue(admin, { force: false });
    }
    const [errors, queue] = await Promise.all([
      listErrorLogs({ includeResolved: false, limit: 25 }, admin),
      listSheetSyncQueue(admin),
    ]);

    const failedOrPendingQueue = queue.filter((q) => q.status !== "synced");

    return NextResponse.json({
      errors,
      unresolvedCount: errors.length,
      queue,
      failedQueueCount: failedOrPendingQueue.length,
    });
  } catch (err: any) {
    console.error("[api/admin/errors] GET error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/errors
 * Allows Super Admin to trigger an immediate retry/backfill of the sheet sync queue
 * or mark specific error_log items as resolved.
 */
export async function POST(request: Request) {
  try {
    const auth = await authorizeSuperAdminOrHeader(request);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || "retry_queue";
    const admin = createAdminClient();

    if (action === "resolve") {
      await resolveErrorLogs(
        {
          id: body.id,
          booking_id: body.booking_id,
          all: Boolean(body.all),
        },
        admin
      );
      await logAuditEvent({
        action: "error_log_dismissed",
        actor_email: auth.actorEmail,
        details: {
          id: body.id || null,
          booking_id: body.booking_id || null,
          all: Boolean(body.all),
        },
      });
    } else {
      const queueResult = await processSheetSyncQueue(admin, { force: true });
      await logAuditEvent({
        action: "sheet_sync_queue_manual_retry",
        actor_email: auth.actorEmail,
        details: {
          processed: queueResult.processed,
          succeeded: queueResult.succeeded,
          failed: queueResult.failed,
        },
      });
    }

    const [errors, queue] = await Promise.all([
      listErrorLogs({ includeResolved: false, limit: 25 }, admin),
      listSheetSyncQueue(admin),
    ]);

    return NextResponse.json({
      ok: true,
      errors,
      unresolvedCount: errors.length,
      queue,
      failedQueueCount: queue.filter((q) => q.status !== "synced").length,
    });
  } catch (err: any) {
    console.error("[api/admin/errors] POST error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
