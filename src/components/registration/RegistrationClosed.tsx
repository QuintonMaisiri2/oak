import Link from "next/link";
import { CalendarDays, LogIn } from "lucide-react";

/** Shown on the home and /register pages once public registration has closed. */
export function RegistrationClosed() {
  return (
    <div className="page-container">
      <div className="mx-auto max-w-xl space-y-6 py-6">
        <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-tr from-[#14233C] via-[#1A2F50] to-[#253F6B] px-8 py-9 text-white shadow-md">
          <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="relative z-10">
            <h1 className="mb-2 text-3xl font-black leading-tight tracking-tight text-white sm:text-[34px]">
              Grantee<br />Convening 2026
            </h1>
            <p className="text-sm tracking-wide text-slate-300/90">Harare · 9–11 November 2026</p>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200/90 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-[#0E1726]">Registration has closed</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The convening has ended. Thank you to everyone who joined us in Harare. If you attended, sign in with the Google
            account you registered with to see the programme, session summaries, photos and shared files.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/admin/login"
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#162E55] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1C2E5A]"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In with Google</span>
            </Link>
            <Link
              href="/programme"
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <span>View the Programme</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
