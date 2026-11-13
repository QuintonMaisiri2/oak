import { REGISTRATION_OPEN } from "@/lib/registration";
import Link from "next/link";
import { Lock, UserPlus, LogIn, CalendarDays } from "lucide-react";

export function DirectoryAccessGate({
  title = "Grantee Directory",
  description = "The Grantee Directory is reserved for registered attendees and convening staff. If you are already registered, sign in with Google to unlock full access.",
  next = "/directory",
}: { title?: string; description?: string; next?: string } = {}) {
  return (
    <div className="page-shell">
      <div className="rounded-[28px] border border-slate-200/90 bg-white p-8 md:p-10 shadow-sm text-center">
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#162E55]/10 text-[#162E55] flex items-center justify-center mx-auto mb-5 shadow-2xs">
          <Lock className="w-8 h-8" strokeWidth={2.2} />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider mb-3 font-sans">
          Participants &amp; Staff Only
        </span>

        <h1
          className="text-2xl md:text-3xl font-bold text-[#0E1726] mb-3 tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {title}
        </h1>

        <p className="text-sm text-[#6B7590] leading-relaxed mb-8 max-w-md mx-auto">
          {description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            href={`/admin/login?next=${encodeURIComponent(next)}`}
            className="flex-1 bg-[#162E55] hover:bg-[#1C2E5A] text-white font-bold text-sm py-3.5 px-6 rounded-2xl transition shadow-sm flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In with Google</span>
          </Link>

          {REGISTRATION_OPEN && (
            <Link
              href="/register"
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm py-3.5 px-6 rounded-2xl transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-slate-500" />
              <span>Register for Event</span>
            </Link>
          )}
        </div>

        {/* Public Programme Notice */}
        <div className="pt-6 border-t border-slate-100 flex flex-col items-center">
          <p className="text-xs text-slate-500 mb-2">
            Looking for the convening agenda and sessions?
          </p>
          <Link
            href="/programme"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#162E55] hover:underline"
          >
            <CalendarDays className="w-3.5 h-3.5 text-[#162E55]" />
            <span>The Programme is open to everyone &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
