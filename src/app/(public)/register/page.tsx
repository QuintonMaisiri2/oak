import { Suspense } from "react";
import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { RegistrationStats } from "@/components/registration/RegistrationStats";
import { RegistrationClosed } from "@/components/registration/RegistrationClosed";
import { REGISTRATION_OPEN } from "@/lib/registration";

export default function RegisterPage() {
  if (!REGISTRATION_OPEN) return <RegistrationClosed />;

  return (
    <div className="page-container">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <Suspense
          fallback={
            <div className="h-48 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-[#1A2F50]" />
            </div>
          }
        >
          <RegistrationForm />
        </Suspense>

        {/* Event summary: beside the form on desktop, below it on mobile */}
        <div className="space-y-6 lg:sticky lg:top-6">
          {/* BEGIN: HeroBanner */}
          <section className="relative rounded-[24px] h-[167px] bg-gradient-to-tr from-[#14233C] via-[#1A2F50] to-[#253F6B] text-white px-8 py-9 shadow-md overflow-hidden">
            <div className="absolute -top-16 -right-16 w-60 h-60 bg-blue-400/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="relative z-10">
              <h1 className="text-3xl sm:text-[34px] font-black tracking-tight leading-tight mb-2 text-white">
                Grantee<br />Convening 2026
              </h1>
              <p className="text-sm font-normal text-slate-300/90 tracking-wide">
                Harare · 9–11 November 2026
              </p>
            </div>
          </section>
          {/* END: HeroBanner */}

          {/* BEGIN: StatsCards */}
          <RegistrationStats />
          {/* END: StatsCards */}
        </div>
      </div>

      {/* BEGIN: FormFooterNote */}
      <div className="text-center pt-8 pb-10">
        <p className="text-[11px] text-slate-400">
          Your data is secured and handled by OAK Foundation in accordance with GDPR.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          &copy; 2026 uncommon.org. All rights reserved.
        </p>
      </div>
      {/* END: FormFooterNote */}
    </div>
  );
}
