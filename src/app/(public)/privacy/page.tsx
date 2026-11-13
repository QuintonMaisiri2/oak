"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 font-sans text-[15px] font-normal leading-[22px] text-[#6B7590]">
            Last updated: September 2026
          </p>
        </header>

        <section className="rounded-[24px] bg-white p-8 sm:p-10 shadow-sm border border-slate-100 space-y-6 text-sm text-slate-600 leading-relaxed font-sans">
          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>1. Information We Collect</h2>
          <p>
            When you register for the OAK Grantee Convening 2026, we collect basic personal information including your name, email address, organization, and professional role. This information is required to manage your event registration and attendance.
          </p>

          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>2. How We Use Your Information</h2>
          <p>
            Your information is used exclusively for event administration purposes, including generating entry passes, tracking check-ins, and sending important event updates. We do not use your information for marketing purposes unrelated to this specific convening.
          </p>

          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>3. Google Workspace Data</h2>
          <p>
            For administrative staff, our application uses Google OAuth to verify your identity. We only request basic profile information (email address) to confirm authorization. We do not access, store, or modify any other data in your Google Workspace account.
          </p>

          <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "var(--font-sans)" }}>4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage. All data is securely stored and transmitted using industry-standard encryption.
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
