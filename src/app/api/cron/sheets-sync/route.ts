import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { logAuditEvent } from "@/lib/audit";
import { processSheetSyncQueue } from "@/lib/sheets/sync";

export const dynamic = "force-dynamic";

async function isAuthorizedCronOrAdmin(request: Request): Promise<{
  authorized: boolean;
  actor: string;
}> {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = (process.env.CRON_SECRET || "").trim();

  // 1. Check CRON_SECRET Bearer token if configured
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, actor: "vercel-cron" };
  }

  // 2. Check Vercel Cron user-agent / header when CRON_SECRET is not set
  const userAgent = request.headers.get("user-agent") || "";
  if (!cronSecret && /vercel-cron/i.test(userAgent)) {
    return { authorized: true, actor: "vercel-cron" };
  }

  // 3. Check Admin session or x-admin-password header
  const adminCheck = await requireAdmin();
  if (!adminCheck.response) {
    return {
      authorized: true,
      actor: adminCheck.adminUser?.email || adminCheck.user?.email || "admin",
    };
  }

  const fallbackAuth = await verifyMeetingAdminAuth(request);
  if (fallbackAuth.authorized) {
    return { authorized: true, actor: fallbackAuth.adminEmail || "admin" };
  }

  return { authorized: false, actor: "" };
}

/**
 * GET /api/cron/sheets-sync
 * Scheduled production worker (invoked by Vercel Cron or Admin) to process
 * due items in `sheet_sync_queue` with exponential backoff and backfill unsynced bookings.
 */
export async function GET(request: Request) {
  try {
    const auth = await isAuthorizedCronOrAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: "Forbidden — Cron secret or Admin access required" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    const admin = createAdminClient();
    const result = await processSheetSyncQueue(admin, { force });

    await logAuditEvent({
      action: "sheet_sync_queue_worker",
      actor_email: auth.actor,
      details: {
        force,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        skippedNotDue: result.skippedNotDue,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[cron/sheets-sync] Error processing queue:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
