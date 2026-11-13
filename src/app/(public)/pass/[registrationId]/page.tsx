"use client";

import { REGISTRATION_OPEN } from "@/lib/registration";
import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EntryPassCard } from '@/components/pass/EntryPassCard';
import { LatestFilesStrip } from '@/components/drive/LatestFilesStrip';
import { MyBreakoutCard } from '@/components/breakouts/MyBreakoutCard';
import type { AttendeeRecord } from '@/lib/mockApi';
import { ShieldCheck, LockKeyhole, AlertCircle, ArrowRight, Clock } from 'lucide-react';

export default function PassPage({ params }: { params: Promise<{ registrationId: string }> }) {
  const router = useRouter();
  const { registrationId } = use(params);
  
  const [attendee, setAttendee] = useState<AttendeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [unauthorizedAccount, setUnauthorizedAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const autoDownloadRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function loadAttendee() {
      try {
        const { fetchAttendee } = await import('@/lib/mockApi');
        const result = await fetchAttendee(registrationId);
        
        if (!mounted) return;

        if (result.success) {
          setAttendee(result.data);
          setRequiresAuth(false);
        } else if (result.requiresAuth) {
          setRequiresAuth(true);
          setError(result.error);
          setUnauthorizedAccount(result.unauthorizedAccount || null);
        } else {
          setError(result.error || "Pass not found");
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || 'Unable to load ticket');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAttendee();
    return () => { mounted = false; };
  }, [registrationId]);

  // Automatically download ticket when user arrives with ?autoDownload=true
  useEffect(() => {
    if (!attendee || autoDownloadRef.current) return;

    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('autoDownload') === 'true') {
        autoDownloadRef.current = true;
        setDownloadNotice('Downloading your entry ticket...');

        const timer = setTimeout(async () => {
          try {
            const { downloadTicket } = await import('@/lib/ticket/downloadTicket');
            const success = await downloadTicket({
              firstName: attendee.firstName,
              lastName: attendee.lastName,
              organization: attendee.organization,
              role: attendee.role,
              registrationId: attendee.registrationId,
              qrCodeId: attendee.qrCodeId,
              location: 'Harare, Zimbabwe',
            });

            if (success) {
              setDownloadNotice('Your entry ticket has been downloaded to your device.');
              router.replace(`/pass/${registrationId}`, { scroll: false });
            } else {
              setDownloadNotice(null);
            }
          } catch {
            setDownloadNotice(null);
          }
        }, 350);

        return () => clearTimeout(timer);
      }
    }
  }, [attendee, registrationId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1A2F50] border-t-transparent"></div>
      </div>
    );
  }

  // PROTECTED TICKET ACCESS GATE
  if (requiresAuth) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] md:bg-[#f5f1eb] flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 md:p-10 rounded-[28px] shadow-sm border border-slate-100 max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1C2C4F] flex items-center justify-center text-white mb-5 shadow-md">
            <LockKeyhole className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider mb-3 font-sans">
            Protected Event Ticket
          </span>

          <h1
            className="text-2xl font-bold text-[#0E1726] mb-2 tracking-tight"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {unauthorizedAccount ? "Access Restricted" : "Sign In to View Ticket"}
          </h1>

          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            {error || "This event pass is protected. Please sign in with your registered Google account to view and download your ticket."}
          </p>

          <div className="w-full space-y-3">
            <button
              onClick={() => {
                window.location.assign(`/api/auth/start?next=${encodeURIComponent(`/pass/${registrationId}`)}`);
              }}
              className="w-full h-12 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold shadow-sm flex items-center justify-center gap-3 transition cursor-pointer"
              style={{ fontFamily: 'var(--font-sans)' }}
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
              <span>{unauthorizedAccount ? "Sign In with Another Account" : "Continue with Google"}</span>
            </button>

            {unauthorizedAccount && (
              <button
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.dispatchEvent(new Event('oak-admin-auth-changed'));
                  window.location.reload();
                }}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-red-600 transition cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Only verified account holders can access this ticket.</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !attendee) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#1C2E5A] mb-2">Pass Not Found</h2>
          <p className="text-slate-600 text-sm mb-3 leading-relaxed">
            {error || "We couldn't find an attendee pass matching this registration code."}
          </p>
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-500 mb-6">
            {registrationId}
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Link 
              href={REGISTRATION_OPEN ? "/register" : "/admin/login"}
              className="w-full inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[#1C2E5A] text-white text-sm font-semibold shadow hover:bg-[#283a5d] transition-colors"
            >
              {REGISTRATION_OPEN ? "Go to Registration Page" : "Sign In with Google"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] md:bg-[#f5f1eb] text-slate-800 antialiased relative">
      <main className="page-shell flex flex-col items-center">
        <div className="w-full space-y-6">
          <section className="relative w-full md:w-[608px] min-h-[151px] overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1C2E5A] to-[#2D4A82] text-white p-6 sm:p-7 shadow-[0_10px_30px_rgba(29,54,93,0.08)]" data-purpose="registration-banner">
            <div className="flex items-start gap-5">
              <div className="w-[56px] h-[56px] rounded-[16px] bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                <div className="w-[28px] h-[28px] rounded-full border-[2px] border-white flex items-center justify-center">
                  <svg className="w-[16px] h-[16px] text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold tracking-[0.14em] text-white/60 uppercase block mb-1">
                  REGISTRATION COMPLETE
                </span>
                <h1 
                  className="w-full text-[24px] font-bold tracking-normal text-white mb-1.5 leading-[30px]"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  You&apos;re Registered,<br />
                  {attendee.firstName.charAt(0).toUpperCase() + attendee.firstName.slice(1)}!
                </h1>
                <p className="font-sans text-[14px] font-normal leading-[20px] tracking-normal text-white/70">
                  {attendee.organization}
                </p>
              </div>
            </div>
          </section>

          {downloadNotice && (
            <div className="w-full md:w-[608px] bg-[#E6F4EA] border border-[#CEEAD6] rounded-[20px] p-4 flex items-center gap-3 text-[#0D652D] shadow-sm animate-in fade-in zoom-in-95 duration-300">
              <div className="w-8 h-8 rounded-[10px] bg-[#CEEAD6] flex items-center justify-center shrink-0 text-[#0D652D]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 text-sm font-sans font-medium">
                {downloadNotice}
              </div>
              <button
                type="button"
                onClick={() => setDownloadNotice(null)}
                className="text-[#0D652D]/70 hover:text-[#0D652D] text-xs font-semibold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <EntryPassCard attendee={attendee} />

          <MyBreakoutCard registrationId={registrationId} />

          {/* 1:1 Advisor Clinic CTA for registered attendee */}
          <div className="w-full max-w-[608px] bg-gradient-to-r from-[#1C2C4F] to-[#2B4374] rounded-[24px] p-5 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                Exclusive for Registered Attendees
              </span>
              <h3 className="text-base font-bold text-white">Book a 1:1 Meeting</h3>
              <p className="text-xs text-slate-200">
                Schedule a 1:1 session with Silvia Guizzardi for tailored MEL and impact guidance.
              </p>
            </div>
            <Link
              href="/book"
              className="px-4 py-2.5 rounded-xl bg-white text-[#1C2C4F] hover:bg-slate-100 text-xs font-bold transition shadow-sm whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Clock className="w-4 h-4 text-[#1C2C4F]" />
              <span>Book 1:1 Session</span>
            </Link>
          </div>

          <LatestFilesStrip />

          <div className="text-center mt-4 pb-8 md:pb-0 flex items-center justify-center gap-4 text-xs text-slate-500 flex-wrap">
            {REGISTRATION_OPEN && (
              <>
                <Link href="/register" className="inline-flex items-center justify-center gap-1.5 font-sans font-medium text-[13px] text-[#6B7590] hover:text-[#1C2E5A] transition-colors">
                  <svg className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Register another attendee</span>
                </Link>
                <span className="text-slate-300">•</span>
              </>
            )}
            <Link href="/privacy" target="_blank" className="inline-flex items-center gap-1 font-bold text-[#1C2E5A] hover:underline transition">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Privacy Policy</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
