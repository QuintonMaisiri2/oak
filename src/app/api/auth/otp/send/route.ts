import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/auth/policy";
import { getClientIp, isEligibleForSignIn } from "@/lib/auth/finalize-login";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import { sendEmailWithRetry } from "@/lib/email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

const CODE_SENT = {
  success: true,
  message: "A sign-in code is on its way. Check your inbox (and spam folder).",
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Email sign-in is not available right now." }, { status: 503 });
  }

  let email = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    // fall through to validation error
  }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const clientIp = getClientIp(request) || "unknown";
  const ipLimit = checkRateLimit(`otp_send_ip:${clientIp}`, 10, FIFTEEN_MINUTES);
  const emailLimit = checkRateLimit(`otp_send_email:${email}`, 3, FIFTEEN_MINUTES);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many code requests. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  try {
    if (!(await isEligibleForSignIn(email))) {
      await logAuditEvent({
        action: "otp_request_denied",
        actor_email: email,
        reason: "not_allowed",
        ip_address: clientIp,
        user_agent: request.headers.get("user-agent"),
      });
      return NextResponse.json(
        {
          error: `No registration found for "${email}". Check the spelling, or register for the event first.`,
          notRegistered: true,
        },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Generate the code via the Admin API (which sends nothing) and deliver it with the app's own
    // email provider, so no Supabase SMTP or template configuration is required.
    const adminClient = createAdminClient();

    // Registered attendees may not have a Supabase Auth user yet. Eligibility is enforced above,
    // and the session only exists after verifyOtp proves mailbox ownership.
    const { error: createError } = await adminClient.auth.admin.createUser({ email, email_confirm: true });
    if (createError && createError.code !== "email_exists" && !/already/i.test(createError.message)) {
      console.error("OTP user provisioning failed:", createError);
      return NextResponse.json({ error: "We couldn't send a code right now. Please try again." }, { status: 503 });
    }

    const { data: link, error: linkError } = await adminClient.auth.admin.generateLink({ type: "magiclink", email });
    const code = link?.properties?.email_otp;
    if (linkError || !code) {
      console.error("OTP generation failed:", linkError);
      return NextResponse.json({ error: "We couldn't send a code right now. Please try again." }, { status: 503 });
    }

    const sent = await sendEmailWithRetry({
      to: email,
      subject: `Your OAK sign-in code: ${code}`,
      text: `Your OAK sign-in code is ${code}\n\nEnter it on the sign-in page to access your event pass. If you didn't request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0E1726;max-width:480px">
  <h2 style="color:#1C2C4F">Your OAK sign-in code</h2>
  <p>Enter this code on the sign-in page to access your event pass:</p>
  <p style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
  <p style="color:#6B7590;font-size:13px">If you didn't request this code, you can ignore this email.</p>
</div>`,
    });
    if (!sent.success) {
      console.error("OTP email delivery failed:", sent.error);
      return NextResponse.json({ error: "We couldn't send a code right now. Please try again." }, { status: 503 });
    }

    await logAuditEvent({ action: "otp_sent", actor_email: email, ip_address: clientIp });
    return NextResponse.json(CODE_SENT, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("OTP send route failed:", error);
    return NextResponse.json({ error: "We couldn't send a code right now. Please try again." }, { status: 503 });
  }
}
