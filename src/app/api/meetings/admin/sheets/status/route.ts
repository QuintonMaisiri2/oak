import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { logAuditEvent } from "@/lib/audit";
import {
  constantTimeEqualSecrets,
  getSheetWebhookConfigStatus,
  pingSheetsWebhook,
  testSheetConnection,
} from "@/lib/sheets/sync";
import { getSheetsAuthDiagnostics, verifyLiveSheetHeaderRead } from "@/lib/sheets/auth";

async function authorizeAdminRequest(request: Request): Promise<{
  authorized: boolean;
  actorEmail: string;
  response?: NextResponse;
}> {
  // Allow constant-time CRON_SECRET Bearer token for CLI ping / diagnostics
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  if (authHeader.toLowerCase().startsWith("bearer ") && cronSecret) {
    const providedBearer = authHeader.slice(7).trim();
    if (constantTimeEqualSecrets(providedBearer, cronSecret)) {
      return {
        authorized: true,
        actorEmail: "system:cron",
      };
    }
  }

  const adminCheck = await requireAdmin();
  if (!adminCheck.response) {
    return {
      authorized: true,
      actorEmail: adminCheck.adminUser?.email || adminCheck.user?.email || "",
    };
  }

  if (adminCheck.response.status === 403) {
    return { authorized: false, actorEmail: "", response: adminCheck.response };
  }

  const fallbackAuth = await verifyMeetingAdminAuth(request);
  if (!fallbackAuth.authorized) {
    return {
      authorized: false,
      actorEmail: "",
      response: NextResponse.json(
        { error: "Forbidden — Admin access required" },
        { status: fallbackAuth.status || 403 }
      ),
    };
  }

  return { authorized: true, actorEmail: fallbackAuth.adminEmail };
}

/**
 * GET /api/meetings/admin/sheets/status
 * Returns boolean presence of SHEETS_WEBHOOK_URL and SHEETS_WEBHOOK_SECRET (never the values)
 * and sends a test request to verify connection status.
 */
export async function GET(request: Request) {
  try {
    const auth = await authorizeAdminRequest(request);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const skipTest = url.searchParams.get("skipTest") === "true";
    const readHeaders = url.searchParams.get("readHeaders") === "true";
    const action = url.searchParams.get("action");

    if (action === "ping") {
      const pingResult = await pingSheetsWebhook();
      return NextResponse.json(pingResult);
    }

    if (readHeaders) {
      const headerRead = await verifyLiveSheetHeaderRead(request);
      return NextResponse.json(headerRead);
    }

    const authDiagnostics = getSheetsAuthDiagnostics(request);

    if (skipTest) {
      const config = getSheetWebhookConfigStatus();
      return NextResponse.json({
        ok: config.isConfigured && !config.urlEndsWithDev,
        hasUrl: config.hasUrl,
        hasSecret: config.hasSecret,
        isConfigured: config.isConfigured,
        urlEndsWithExec: config.urlEndsWithExec,
        urlEndsWithDev: config.urlEndsWithDev,
        isNotPlaceholder: config.isNotPlaceholder,
        authDiagnostics,
        error: !config.isConfigured
          ? "Missing SHEETS_WEBHOOK_URL or SHEETS_WEBHOOK_SECRET"
          : config.urlEndsWithDev
          ? "SHEETS_WEBHOOK_URL ends in /dev instead of /exec"
          : null,
        testedAt: null,
      });
    }

    const result = await testSheetConnection();
    return NextResponse.json({
      ...result,
      authDiagnostics,
    });
  } catch (err: any) {
    console.error("[admin/sheets/status] GET error:", err?.message || "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/meetings/admin/sheets/status
 * Explicitly sends a live test request to the Google Sheet webhook and records it in the audit log.
 */
export async function POST(request: Request) {
  try {
    const auth = await authorizeAdminRequest(request);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const result = await testSheetConnection();
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await logAuditEvent({
      action: "sheet_webhook_test",
      actor_email: auth.actorEmail,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: {
        ok: result.ok,
        hasUrl: result.hasUrl,
        hasSecret: result.hasSecret,
        secretLength: result.secretLength,
        urlEndsWithExec: result.urlEndsWithExec,
        isNotPlaceholder: result.isNotPlaceholder,
        scriptVersion: result.scriptVersion,
        sheetTabName: result.sheetTabName,
        cause: result.cause,
        error: result.error,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[admin/sheets/status] POST error:", err?.message || "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
