"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { isValidAdminEmailDomain } from "@/lib/auth/domains";

function VerifyStaffForm() {
  const searchParams = useSearchParams();

  const emailParam = searchParams.get("email") || "";
  const nameParam = searchParams.get("name") || "";

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const cleanEmail = emailParam.trim().toLowerCase();
  const isValidAdminEmail = isValidAdminEmailDomain(cleanEmail);

  useEffect(() => {
    if (!cleanEmail || !isValidAdminEmail) {
      setError("A valid organization email (@oakfnd.org, @oakfnd.ch, or @uncommon.org) is required to verify a staff account.");
    }
  }, [cleanEmail, isValidAdminEmail]);

  const handleGoogleLogin = () => {
    if (!isValidAdminEmail) return;
    setIsLoading(true);
    setError(null);
    window.location.assign("/api/auth/start?next=" + encodeURIComponent("/admin"));
  };

  return (
    <div className="page-shell flex flex-col items-center justify-center min-h-[75vh]">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C2C4F] text-white shadow-md">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1
            className="text-[24px] font-bold leading-[32px] tracking-normal text-[#0E1726]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Verify Staff Account
          </h1>
          <p className="mt-1 font-sans text-[14px] font-normal leading-[20px] text-[#6B7590]">
            Sign in with Google to securely link your registration to your OAK Dashboard access.
          </p>
        </header>

        <section className="rounded-[24px] bg-white p-6 sm:p-8 shadow-sm border border-slate-100">
          {/* Admin Identity Badge */}
          {nameParam && cleanEmail && (
            <div className="mb-5 p-3.5 rounded-2xl bg-[#EEF1F5] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1C2E5A] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {nameParam.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#0E1726] truncate">
                    {nameParam}
                  </p>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                </div>
                <p className="text-[11px] text-[#6B7590] truncate font-mono">{cleanEmail}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading || !isValidAdminEmail}
              className="w-full h-12 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-sm flex items-center justify-center gap-3 transition cursor-pointer disabled:opacity-75"
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
              <span>{isLoading ? "Redirecting to Google..." : "Sign in with Google"}</span>
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-[#6B7590]">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">OAK Staff Access Policy</p>
              <p className="text-slate-500 mt-0.5">
                Staff accounts with authorized organization domains (@oakfnd.org, @oakfnd.ch, @uncommon.org) on the active admin allowlist are granted full coordinator and attendance check-in access. Sign in using your registered Google account to gain entry.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell flex items-center justify-center min-h-[75vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary"></div>
        </div>
      }
    >
      <VerifyStaffForm />
    </Suspense>
  );
}
