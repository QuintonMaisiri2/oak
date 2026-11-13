"use client";

import { REGISTRATION_OPEN } from "@/lib/registration";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LockKeyhole, Ticket, UserCheck, AlertCircle, Mail, ArrowLeft } from "lucide-react";

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/admin";
  const errorParam = searchParams.get("error");
  const emailParam = searchParams.get("email");
  const refParam = searchParams.get("ref");
  const isRegistered = searchParams.get("registered") === "true";
  const registeredRole = searchParams.get("role") || "Grantee";
  const registeredEmail = searchParams.get("email");

  useEffect(() => {
    if (!errorParam) {
      setError(null);
      return;
    }

    if (
      errorParam === "not-allowed" ||
      errorParam === "not-authorized" ||
      errorParam === "unauthorized-domain" ||
      errorParam === "not-registered" ||
      errorParam === "domain-mismatch" ||
      errorParam === "unverified-email" ||
      errorParam === "email-not-verified"
    ) {
      setError("Your email isn't authorised yet, contact vincent@uncommon.org");
    } else if (errorParam === "cancelled" || errorParam === "access_denied") {
      setError("Sign-in was cancelled");
    } else if (errorParam === "org-blocked" || errorParam === "admin_policy_enforced" || errorParam === "org_internal") {
      setError("Your organisation blocks this app, ask your IT team to approve it");
    } else {
      const refCode =
        refParam && /^ERR-[A-Z0-9-]+$/i.test(refParam)
          ? refParam.toUpperCase()
          : "ERR-00000";
      setError(`Something went wrong, reference ${refCode}`);
    }
  }, [errorParam, refParam]);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError(null);
    window.location.assign("/api/auth/start?next=" + encodeURIComponent(nextPath));
  };

  const [otpEmail, setOtpEmail] = useState(registeredEmail || "");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [otpNotRegistered, setOtpNotRegistered] = useState(false);

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsOtpLoading(true);
    setError(null);
    setOtpNotice(null);
    setOtpNotRegistered(false);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "We couldn't send a code. Please try again.");
        setOtpNotRegistered(Boolean(data.notRegistered));
        return;
      }
      setOtpNotice(data.message || "A sign-in code is on its way.");
      setOtpCode("");
      setOtpStep("code");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOtpLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, token: otpCode, next: nextPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.redirect) {
        window.location.assign(data.redirect);
        return;
      }
      setError(data.error || "Sign-in failed. Please try again.");
    } catch {
      setError("Network error. Please check your connection and try again.");
    }
    setIsOtpLoading(false);
  };

  const isStaffRole = registeredRole === "Coordination Team" || registeredRole === "OAK Staff";

  return (
    <div className="page-shell flex flex-col items-center justify-center min-h-[75vh]">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C2C4F] text-white shadow-md">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1
            className="text-[26px] font-bold leading-[34px] tracking-normal text-[#0E1726]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Sign In
          </h1>
          <p className="mt-1.5 font-sans text-[14px] font-normal leading-[20px] text-[#6B7590]">
            Access your event ticket, participant directory, or staff dashboard
          </p>
        </header>

        <section className="rounded-[24px] bg-white p-6 sm:p-8 shadow-sm border border-slate-100">
          {isRegistered && (
            <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-xs font-medium text-emerald-800 border border-emerald-200">
              <p className="font-bold text-emerald-900 mb-0.5">
                Registration Complete ({registeredRole})
              </p>
              <p>
                {isStaffRole
                  ? `As a member of the ${registeredRole}, you have administrative access. Sign in below with Google or an email code${registeredEmail ? ` (${registeredEmail})` : ''} to enter the Admin Dashboard.`
                  : `Sign in below with Google or an email code${registeredEmail ? ` (${registeredEmail})` : ''} to view and download your protected Event Ticket.`}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="font-semibold text-red-900">{error}</p>
                {REGISTRATION_OPEN && otpNotRegistered && (
                  <Link
                    href={`/register?email=${encodeURIComponent(otpEmail)}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1C2E5A] underline hover:text-blue-900"
                  >
                    Register now &rarr;
                  </Link>
                )}
                {REGISTRATION_OPEN && !otpNotRegistered &&
                  (errorParam === "not-allowed" ||
                    errorParam === "not-authorized" ||
                    errorParam === "not-registered") && (
                  <Link
                    href={emailParam ? `/register?email=${encodeURIComponent(emailParam)}` : "/register"}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1C2E5A] underline hover:text-blue-900"
                  >
                    Click here to register now &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}

          {otpStep === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-3">
              <label htmlFor="otp-email" className="block text-xs font-semibold text-slate-700">
                Registered email address
              </label>
              <input
                id="otp-email"
                type="email"
                required
                autoComplete="email"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                placeholder="you@organization.org"
                className="w-full h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-800 focus:border-[#1C2E5A] focus:outline-none focus:ring-2 focus:ring-[#1C2E5A]/20"
              />
              <button
                type="submit"
                disabled={isOtpLoading || !otpEmail}
                className="w-full h-12 rounded-xl bg-[#1C2C4F] hover:bg-[#15223d] text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-75"
              >
                <Mail className="w-4 h-4" />
                <span>{isOtpLoading ? "Sending code..." : "Email me a sign-in code"}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-3">
              {otpNotice && (
                <p className="rounded-xl bg-blue-50 p-3 text-xs font-medium text-[#1C2E5A] border border-blue-100">
                  {otpNotice}
                </p>
              )}
              <label htmlFor="otp-code" className="block text-xs font-semibold text-slate-700">
                Code sent to <span className="font-bold">{otpEmail}</span>
              </label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={10}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter code"
                className="w-full h-12 rounded-xl border border-slate-300 px-4 text-center text-lg font-semibold tracking-[0.4em] text-slate-800 focus:border-[#1C2E5A] focus:outline-none focus:ring-2 focus:ring-[#1C2E5A]/20"
              />
              <button
                type="submit"
                disabled={isOtpLoading || otpCode.length < 6}
                className="w-full h-12 rounded-xl bg-[#1C2C4F] hover:bg-[#15223d] text-white text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-75"
              >
                {isOtpLoading ? "Verifying..." : "Verify and sign in"}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep("email");
                    setOtpNotice(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Use a different email
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCode()}
                  disabled={isOtpLoading}
                  className="font-semibold text-[#1C2E5A] hover:underline cursor-pointer disabled:opacity-60"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or continue with Google
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold shadow-sm flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-75"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>{isLoading ? "Connecting to Google..." : "Continue with Google"}</span>
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-xs text-[#6B7590]">
            <div className="flex items-start gap-2.5">
              <Ticket className="w-4 h-4 text-[#1C2E5A] shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">Registered Participants</strong>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sign in with Google or a one-time code sent to your registered email to securely view your event pass and access the Grantee Directory.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">Oak Staff & Administrators</strong>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  All verified <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded font-mono">@oakfnd.ch</code> staff can sign in directly for participant access. Explicit administrators will open the Admin Dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        {REGISTRATION_OPEN && (
        <div className="text-center space-y-2">
          <p className="text-xs text-slate-500">
            Have not registered yet?{" "}
            <Link
              href="/register"
              className="font-bold text-[#1C2E5A] hover:underline"
            >
              Register here
            </Link>
          </p>
        </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell flex items-center justify-center min-h-[75vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
