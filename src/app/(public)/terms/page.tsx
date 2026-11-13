"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="page-shell flex flex-col items-center justify-start min-h-[75vh]">
      <div className="w-full max-w-2xl space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C2C4F] text-white shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1
            className="text-[28px] font-bold leading-[36px] tracking-normal text-[#0E1726]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Terms of Service
          </h1>
          <p className="mt-2 font-sans text-[15px] font-normal leading-[22px] text-[#6B7590]">
            Last updated: September 2026
          </p>
        </header>

        <section className="rounded-[24px] bg-white p-8 sm:p-10 shadow-sm border border-slate-100 space-y-6 text-sm text-slate-600 leading-relaxed font-sans">
          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>1. Acceptance of Terms</h2>
          <p>
            By registering for and using the OAK Grantee Convening 2026 application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use this application to register for the event.
          </p>

          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>2. Registration and Passes</h2>
          <p>
            Event registration passes are issued to specific individuals and are non-transferable. You must provide accurate and complete information during the registration process. The event organizers reserve the right to revoke or deny entry to any individual at their discretion.
          </p>

          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>3. Administrative Access</h2>
          <p>
            Access to the administrative dashboard is strictly limited to authorized personnel. Attempting to bypass security measures or access administrative functions without proper authorization is strictly prohibited.
          </p>

          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>4. Liability</h2>
          <p>
            The OAK Grantee Convening organizers and the developers of this application are not liable for any technical disruptions, data loss, or other damages arising from the use of this application.
          </p>
        </section>

        <div className="text-center pb-12">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-[#1C2E5A] transition"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
