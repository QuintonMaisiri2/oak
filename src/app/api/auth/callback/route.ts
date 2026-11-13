import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_COOKIE_OPTIONS } from "@/lib/auth/policy";
import { logAuditEvent } from "@/lib/audit";
import { PASS_ACCESS_COOKIE } from "@/lib/auth/pass-access";
import { applyAttendeeCookies, generateRequestId, getClientIp, resolveLogin } from "@/lib/auth/finalize-login";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = generateRequestId();
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || null;

  const redirectWithClearedCookies = (path: string) => {
    const response = NextResponse.redirect(new URL(path + "#", url.origin));
    response.headers.set("Cache-Control", "no-store");
    for (const name of [
      "oak_role",
      "oak_admin_session",
      "oak_admin_email",
      "oak_partner_pass",
      "oak_attendee_email",
      PASS_ACCESS_COOKIE,
    ]) {
      response.cookies.set(name, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
    }
    return response;
  };

  try {
    // 1. Check for OAuth provider error returned in query string
    if (url.searchParams.has("error")) {
      const oauthError = (url.searchParams.get("error") || "").trim().toLowerCase();
      const oauthDesc = (url.searchParams.get("error_description") || "").trim().toLowerCase();

      const isOrgBlocked =
        /admin_policy_enforced|org_internal|restricted_client|unauthorized_client|app_not_configured|access_not_configured|disallowed_useragent/i.test(
          `${oauthError} ${oauthDesc}`
        );

      const isCancelled =
        !isOrgBlocked &&
        (oauthError === "access_denied" ||
          oauthError === "user_cancelled_login" ||
          /cancel|denied_by_user|user_denied/i.test(oauthDesc));

      await logAuditEvent({
        action: "login_denied",
        reason: isCancelled ? "cancelled" : "provider_error",
        ip_address: clientIp,
        user_agent: userAgent,
        request_id: requestId,
        details: {
          oauth_error: oauthError,
          org_blocked: isOrgBlocked,
        },
      });

      if (isOrgBlocked) {
        return redirectWithClearedCookies(
          `/admin/login?error=org-blocked&ref=${encodeURIComponent(requestId)}`
        );
      }
      if (isCancelled) {
        return redirectWithClearedCookies(
          `/admin/login?error=cancelled&ref=${encodeURIComponent(requestId)}`
        );
      }
      return redirectWithClearedCookies(
        `/admin/login?error=provider-error&ref=${encodeURIComponent(requestId)}`
      );
    }

    // 2. Require authorization code
    const code = url.searchParams.get("code");
    if (!code) {
      await logAuditEvent({
        action: "login_denied",
        reason: "callback_error",
        ip_address: clientIp,
        user_agent: userAgent,
        request_id: requestId,
        details: { stage: "missing_code" },
      });
      return redirectWithClearedCookies(
        `/admin/login?error=callback-error&ref=${encodeURIComponent(requestId)}`
      );
    }

    const client = await createClient();
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      await logAuditEvent({
        action: "login_denied",
        reason: "callback_error",
        ip_address: clientIp,
        user_agent: userAgent,
        request_id: requestId,
        details: { stage: "exchange_code_failed", status: exchangeError.status || 400 },
      });
      return redirectWithClearedCookies(
        `/admin/login?error=callback-error&ref=${encodeURIComponent(requestId)}`
      );
    }

    // 3. Retrieve authenticated user from Supabase Auth
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user || !user.email) {
      await logAuditEvent({
        action: "login_denied",
        reason: "callback_error",
        ip_address: clientIp,
        user_agent: userAgent,
        request_id: requestId,
        details: { stage: "get_user_failed" },
      });
      return redirectWithClearedCookies(
        `/admin/login?error=callback-error&ref=${encodeURIComponent(requestId)}`
      );
    }

    // 4-6. Allow-list enforcement, staff pass provisioning, and audit logging (shared with email OTP)
    const result = await resolveLogin({
      client,
      user,
      nextParam: url.searchParams.get("next"),
      clientIp,
      userAgent,
      requestId,
      method: "google",
    });
    if (!result.ok) return redirectWithClearedCookies(result.destination);

    const response = NextResponse.redirect(new URL(result.destination + "#", url.origin));
    response.headers.set("Cache-Control", "no-store");
    applyAttendeeCookies(response, result.attendee, result.email);
    return response;
  } catch (error: any) {
    await logAuditEvent({
      action: "login_denied",
      reason: "callback_error",
      ip_address: clientIp,
      user_agent: userAgent,
      request_id: requestId,
      details: {
        stage: "unhandled_exception",
        error_type: error?.name || "CallbackError",
      },
    });
    return redirectWithClearedCookies(
      `/admin/login?error=callback-error&ref=${encodeURIComponent(requestId)}`
    );
  }
}
