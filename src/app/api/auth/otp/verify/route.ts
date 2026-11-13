import { NextResponse } from "next/server";
import { createClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/auth/policy";
import { applyAttendeeCookies, generateRequestId, getClientIp, resolveLogin } from "@/lib/auth/finalize-login";
import { checkRateLimit } from "@/lib/rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Email sign-in is not available right now." }, { status: 503 });
  }

  let email = "";
  let token = "";
  let next: string | null = null;
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    token = typeof body?.token === "string" ? body.token.replace(/\s+/g, "") : "";
    next = typeof body?.next === "string" ? body.next : null;
  } catch {
    // fall through to validation error
  }
  if (!email || !/^\d{6,10}$/.test(token)) {
    return NextResponse.json({ error: "Please enter the code from your email." }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const ipLimit = checkRateLimit(`otp_verify_ip:${clientIp || "unknown"}`, 30, FIFTEEN_MINUTES);
  const emailLimit = checkRateLimit(`otp_verify_email:${email}`, 8, FIFTEEN_MINUTES);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please request a new code in a few minutes." },
      { status: 429 }
    );
  }

  try {
    const client = await createClient();
    const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
    const user = data?.user;
    if (error || !user || !user.email) {
      return NextResponse.json(
        { error: "That code is invalid or has expired. Please check it or request a new one." },
        { status: 401 }
      );
    }

    const result = await resolveLogin({
      client,
      user,
      nextParam: next,
      clientIp,
      userAgent: request.headers.get("user-agent"),
      requestId: generateRequestId(),
      method: "email_otp",
    });
    const response = NextResponse.json(
      { success: result.ok, redirect: result.destination },
      { headers: { "Cache-Control": "no-store" } }
    );
    if (result.ok) applyAttendeeCookies(response, result.attendee, result.email);
    return response;
  } catch (error) {
    console.error("OTP verify route failed:", error);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 503 });
  }
}
