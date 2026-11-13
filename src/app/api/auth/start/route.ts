import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/policy";
import { logAuditEvent } from "@/lib/audit";

function generateRequestId(): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `ERR-${rand}`;
}

function resolveRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost && !forwardedHost.includes("localhost") && !forwardedHost.startsWith("127.")) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = resolveRequestOrigin(request);
  const requestId = generateRequestId();
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;

  try {
    const client = await createClient();
    const next = safeRedirectPath(url.searchParams.get("next"), "/admin");
    const redirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error || !data?.url) {
      throw error || new Error("No OAuth redirect URL returned");
    }

    const response = NextResponse.redirect(data.url);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error: any) {
    await logAuditEvent({
      action: "login_denied",
      reason: "provider_error",
      ip_address: clientIp,
      user_agent: userAgent,
      request_id: requestId,
      details: {
        stage: "oauth_start",
        error_type: error?.name || "OAuthStartError",
      },
    });
    const failure = new URL(`/admin/login?error=provider-error&ref=${encodeURIComponent(requestId)}`, origin);
    return NextResponse.redirect(failure);
  }
}
