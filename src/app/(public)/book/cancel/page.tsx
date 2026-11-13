"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, Trash2, Calendar, Clock, User, Building } from "lucide-react";

function CancelBookingContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No cancellation token provided.");
      setLoading(false);
      return;
    }

    async function loadDetails() {
      try {
        setLoading(true);
        const res = await fetch(`/api/meetings/cancel?token=${encodeURIComponent(token!)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load booking details");
        setBooking(data.booking);
        if (data.booking?.status === "cancelled") {
          setCancelled(true);
        }
      } catch (err: any) {
        setError(err.message || "Invalid or expired cancellation link.");
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [token]);

  const handleConfirmCancel = async () => {
    if (!token) return;
    try {
      setCancelling(true);
      const res = await fetch("/api/meetings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to cancel booking");
      setCancelled(true);
    } catch (err: any) {
      alert(err.message || "Error cancelling booking");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="page-shell flex items-center justify-center min-h-[75vh]">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200">
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-3 text-xs text-slate-500 font-medium">Loading session details...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Cancellation Error</h1>
            <p className="text-xs text-slate-500 mt-1 mb-6">{error}</p>
            <Link
              href="/book"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Meetings</span>
            </Link>
          </div>
        )}

        {cancelled && !loading && (
          <div className="text-center animate-in fade-in">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Session Cancelled</h1>
            <p className="text-xs text-slate-600 mt-1 mb-6">
              Your 1:1 session has been cancelled and the slot has been returned to the available schedule. Notification emails have been sent.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1C2C4F] text-white text-xs font-bold hover:bg-[#162844] transition shadow-xs"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Book a Different Slot</span>
            </Link>
          </div>
        )}

        {booking && !cancelled && !loading && (
          <div>
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-center text-slate-900">Cancel 1:1 Session</h1>
            <p className="text-xs text-center text-slate-500 mt-1 mb-6">
              Are you sure you want to cancel your session with <strong>{booking.advisor_name}</strong>?
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Attendee</span>
                <span className="font-bold text-slate-800">{booking.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Organisation</span>
                <span className="font-medium text-slate-700">{booking.organisation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Advisor</span>
                <span className="font-medium text-blue-700">{booking.advisor_name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel My Booking</span>
                )}
              </button>

              <Link
                href="/book"
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition flex items-center justify-center"
              >
                Keep My Booking
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CancelBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell flex items-center justify-center min-h-[75vh]">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-3 text-xs text-slate-500 font-medium">Loading session details...</p>
          </div>
        </div>
      }
    >
      <CancelBookingContent />
    </Suspense>
  );
}
