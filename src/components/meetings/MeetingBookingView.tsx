"use client";

import { REGISTRATION_OPEN } from "@/lib/registration";
import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  MessageSquare,
  Building2,
  User,
  Mail,
  Sparkles,
  ShieldAlert,
  LogIn,
  UserCheck,
  UserPlus,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { getSessionStatus, type SessionStatus } from "@/lib/session";
import { AdvisorCard, type Advisor } from "./AdvisorCard";

export interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  note?: string | null;
  is_booked: boolean;
  advisor_id?: string;
  advisor?: {
    id: string;
    slug: string;
    full_name: string;
    job_title: string;
    email: string;
  };
}

interface BookingConfirmation {
  id: string;
  slot_id: string;
  date: string;
  time: string;
  duration: string;
  note?: string | null;
  name: string;
  email: string;
  organisation: string;
  message: string;
  advisor_name?: string;
  advisor_title?: string;
  cancel_token?: string;
}

interface MeetingBookingViewProps {
  initialAdvisorSlug?: string;
}

export function MeetingBookingView({ initialAdvisorSlug }: MeetingBookingViewProps) {
  const [authStatus, setAuthStatus] = useState<SessionStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Advisors
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [activeAdvisor, setActiveAdvisor] = useState<Advisor | null>(null);
  const [advisorsLoading, setAdvisorsLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);

  // Slots
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking Modal
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [message, setMessage] = useState("");

  // Organisation dropdown (same list as the registration form, from /api/partners)
  const [orgOptions, setOrgOptions] = useState<string[]>([]);
  const [orgOptionsLoading, setOrgOptionsLoading] = useState(true);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [isOtherOrg, setIsOtherOrg] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  const maxMessageChars = 500;

  // Load all organisations for the dropdown
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    fetch("/api/partners", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load organisations");
        return res.json();
      })
      .then((partners: { name: string }[]) => {
        if (!mounted) return;
        const names = [...new Set([...partners.map((p) => p.name), "OAK Foundation"])]
          .filter((n) => n && n !== "Other")
          .sort((a, b) => a.localeCompare(b));
        setOrgOptions(names);
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error("Failed to load organisations:", err);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (mounted) setOrgOptionsLoading(false);
      });
    return () => {
      mounted = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // If a pre-filled organisation (from the attendee's registration) is not in the list, treat it as "Other"
  useEffect(() => {
    if (orgOptionsLoading) return;
    if (organisation && !orgOptions.includes(organisation)) {
      setIsOtherOrg(true);
    }
    // Only re-evaluate when the list finishes loading or the prefilled value arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgOptionsLoading, orgOptions, authStatus]);

  // Close the organisation dropdown on outside click
  useEffect(() => {
    if (!isOrgDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOrgDropdownOpen]);

  const filteredOrgOptions = useMemo(() => {
    const term = orgSearch.trim().toLowerCase();
    return term ? orgOptions.filter((o) => o.toLowerCase().includes(term)) : orgOptions;
  }, [orgOptions, orgSearch]);

  const selectOrganisation = (value: string) => {
    if (value === "Other") {
      setIsOtherOrg(true);
      setOrganisation("");
    } else {
      setIsOtherOrg(false);
      setOrganisation(value);
    }
    setIsOrgDropdownOpen(false);
    setOrgSearch("");
  };

  // 1. Check Authentication / Registration
  useEffect(() => {
    let mounted = true;
    getSessionStatus()
      .then((status) => {
        if (!mounted) return;
        setAuthStatus(status);
        if (status.attendee) {
          setName(status.attendee.name || "");
          setEmail(status.attendee.email || "");
          setOrganisation(status.attendee.organization || "");
        }
      })
      .catch((err) => console.warn("Session check warning", err))
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch Advisors and resolve view mode
  useEffect(() => {
    let mounted = true;
    async function loadAdvisors() {
      try {
        setAdvisorsLoading(true);
        const res = await fetch("/api/advisors");
        if (!res.ok) throw new Error("Failed to load advisors");
        const data = await res.json();
        const list: Advisor[] = data.advisors || [];
        if (!mounted) return;
        setAdvisors(list);

        // If initialAdvisorSlug is provided, select matching advisor
        if (initialAdvisorSlug) {
          const match = list.find((a) => a.slug === initialAdvisorSlug);
          if (match) setActiveAdvisor(match);
        } else if (list.length === 1) {
          // Rule 3: With only one active advisor, skip selection step and show directly!
          setActiveAdvisor(list[0]);
        }
      } catch (err: any) {
        console.error("Advisors load error:", err);
      } finally {
        if (mounted) setAdvisorsLoading(false);
      }
    }
    loadAdvisors();
    return () => {
      mounted = false;
    };
  }, [initialAdvisorSlug]);

  // 3. Fetch Slots whenever activeAdvisor changes
  async function fetchSlots() {
    if (!activeAdvisor) return;
    try {
      setSlotsLoading(true);
      setError(null);
      const res = await fetch(`/api/meetings/slots?advisor_id=${activeAdvisor.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load available slots");
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err: any) {
      setError(err.message || "Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    if (activeAdvisor) {
      fetchSlots();
    }
  }, [activeAdvisor]);

  // Helper date formatters
  const formatSlotTime = (startTimeStr: string, endTimeStr: string) => {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Harare",
    };
    return `${start.toLocaleTimeString("en-GB", timeOptions)} - ${end.toLocaleTimeString("en-GB", timeOptions)}`;
  };

  const getDayKey = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-CA", { timeZone: "Africa/Harare" });
  };

  const formatDayHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Harare",
    });
  };

  // Group slots by day
  const groupedSlots = useMemo(() => {
    const groups: { [key: string]: { dayTitle: string; slots: Slot[] } } = {};

    slots.forEach((slot) => {
      const key = getDayKey(slot.start_time);
      if (!groups[key]) {
        groups[key] = {
          dayTitle: formatDayHeader(slot.start_time),
          slots: [],
        };
      }
      groups[key].slots.push(slot);
    });

    return Object.keys(groups)
      .sort()
      .map((k) => groups[k]);
  }, [slots]);

  const handleOpenBooking = (slot: Slot) => {
    if (slot.is_booked) return;
    setSelectedSlot(slot);
    setSubmitError(null);

    if (authStatus?.attendee) {
      if (!name) setName(authStatus.attendee.name);
      if (!email) setEmail(authStatus.attendee.email);
      if (!organisation) {
        const prefilled = authStatus.attendee.organization || "";
        setOrganisation(prefilled);
        if (prefilled && !orgOptionsLoading && !orgOptions.includes(prefilled)) {
          setIsOtherOrg(true);
        }
      }
    }
    setIsOrgDropdownOpen(false);
    setOrgSearch("");
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setSelectedSlot(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    if (!organisation.trim()) {
      setSubmitError(isOtherOrg ? "Please type your organisation name." : "Please select your organisation from the list.");
      return;
    }

    if (!name.trim() || !email.trim() || !message.trim()) {
      setSubmitError("Please fill in all required fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setSubmitError("Please enter a valid email address.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const res = await fetch("/api/meetings/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          name: name.trim(),
          email: email.trim(),
          organisation: organisation.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          await fetchSlots();
          setSubmitError(data.error || "Sorry, that slot was just taken. Please choose another.");
          return;
        }
        if (res.status === 403) {
          setSubmitError(data.error || "Access restricted to registered attendees.");
          return;
        }
        throw new Error(data.error || "Failed to submit booking");
      }

      // Success
      setConfirmation(data.booking);
      setSelectedSlot(null);
      setMessage("");
      fetchSlots();
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Auth Loading Gate
  if (authLoading || advisorsLoading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[75vh]">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-sm w-full text-center shadow-xs">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Verifying session...</p>
        </div>
      </div>
    );
  }

  // 5. Protected Route Access Check
  const isAuthorized = authStatus?.isRegistered || authStatus?.isStaff;
  if (!isAuthorized) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[75vh]">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center animate-in fade-in duration-200">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Protected Route
          </span>

          <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Registered Attendees Only</h1>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            1:1 advisor clinic sessions are exclusively available to registered participants of the <strong>Oak Foundation Partner Gathering 2026</strong>.
          </p>

          <div className="mt-6 space-y-3">
            <Link
              href="/admin/login?next=/book"
              className="w-full py-3 px-4 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In with Google</span>
            </Link>

            {REGISTRATION_OPEN && (
              <Link
                href="/register"
                className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="h-4 w-4 text-blue-600" />
                <span>Register for Event</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 6. Multi-Advisor Selection View (when >1 active advisor and none explicitly selected)
  if (!activeAdvisor && advisors.length > 1) {
    return (
      <div className="page-container">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>OAK Advisor Clinics</span>
              </div>
              {authStatus?.attendee && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Verified: {authStatus.attendee.name}</span>
                </div>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              1:1 Advisor Clinics
            </h1>
            <p className="mt-2 text-base text-slate-600 max-w-2xl">
              Choose an OAK advisor to book a tailored 1:1 session during the convening.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {advisors.map((advisor) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                onBookClick={() => setActiveAdvisor(advisor)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 7. Single Advisor Slot View (Silvia directly, or clicked advisor)
  const currentAdvisor = activeAdvisor || advisors[0];
  const advisorInitials = currentAdvisor?.full_name
    ? currentAdvisor.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "OA";

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        {/* Navigation back to all advisors if multiple exist */}
        {advisors.length > 1 && (
          <button
            onClick={() => setActiveAdvisor(null)}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Choose another advisor</span>
          </button>
        )}

        {/* Advisor Profile Banner */}
        {currentAdvisor && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                {currentAdvisor.photo_url ? (
                  <img
                    src={currentAdvisor.photo_url}
                    alt={currentAdvisor.full_name}
                    className="h-16 w-16 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-2xs">
                    {advisorInitials}
                  </div>
                )}
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-bold">
                    <Sparkles className="h-3 w-3" />
                    <span>OAK Advisor Clinic</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                    Book with {currentAdvisor.full_name}
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-slate-500">
                    {currentAdvisor.job_title}
                  </p>
                </div>
              </div>

              {authStatus?.attendee && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start sm:self-auto">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Verified Attendee: {authStatus.attendee.name}</span>
                </div>
              )}
            </div>

            {/* Advisor Bio with Expander */}
            <div className="mt-5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p className="whitespace-pre-line">
                {bioExpanded
                  ? currentAdvisor.bio
                  : currentAdvisor.bio.length > 280
                  ? `${currentAdvisor.bio.slice(0, 280)}...`
                  : currentAdvisor.bio}
              </p>
              {currentAdvisor.bio.length > 280 && (
                <button
                  onClick={() => setBioExpanded(!bioExpanded)}
                  className="mt-2 text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer text-xs"
                >
                  <span>{bioExpanded ? "Show less" : "Read full clinic overview"}</span>
                  {bioExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>Times shown in <strong>SAST / CAT (Harare local event time, UTC+2)</strong></span>
            </div>
          </div>
        )}

        {/* Global Slots Loading State */}
        {slotsLoading && (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-600">Loading available clinic slots...</p>
          </div>
        )}

        {/* Error State */}
        {error && !slotsLoading && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800 shadow-xs mb-8">
            <AlertCircle className="h-6 w-6 text-rose-600 mx-auto mb-2" />
            <p className="font-semibold text-sm">{error}</p>
            <button
              onClick={fetchSlots}
              className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success Confirmation Screen */}
        {confirmation && (
          <div className="mb-10 bg-white border border-emerald-200 rounded-3xl p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold tracking-wider uppercase text-emerald-700">Reservation Confirmed</span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">You are all set!</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Your 1:1 session with <strong>{confirmation.advisor_name || currentAdvisor?.full_name}</strong> is confirmed. A calendar invite has been sent to <strong>{confirmation.email}</strong>.
                </p>

                <div className="mt-6 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Session Date</span>
                    <span className="font-bold text-slate-800 text-base">{confirmation.date}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Time & Duration</span>
                    <span className="font-bold text-slate-800 text-base">{confirmation.time} ({confirmation.duration})</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Attendee</span>
                    <span className="font-medium text-slate-700">{confirmation.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Organisation</span>
                    <span className="font-medium text-slate-700">{confirmation.organisation}</span>
                  </div>
                  {confirmation.note && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-blue-600 font-semibold block uppercase">Slot Note</span>
                      <span className="font-medium text-blue-800">{confirmation.note}</span>
                    </div>
                  )}
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Discussion Topic</span>
                    <p className="mt-1 text-slate-700 italic text-sm">{confirmation.message}</p>
                  </div>
                </div>

                {/* Shared Drive / Prep Notes Callout */}
                <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-700 leading-relaxed">
                  <p>
                    Want to share slides or notes before your session?{' '}
                    {process.env.NEXT_PUBLIC_DRIVE_UPLOAD_FORM_URL ? (
                      <a
                        href={process.env.NEXT_PUBLIC_DRIVE_UPLOAD_FORM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-blue-700 hover:underline"
                      >
                        Upload them here
                      </a>
                    ) : (
                      <span className="font-bold text-blue-700">Upload them via the shared form</span>
                    )}
                    . Once approved, they will appear on the{' '}
                    <Link href="/drive" className="font-bold text-blue-700 hover:underline">
                      Shared Files page
                    </Link>
                    .
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => setConfirmation(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      setConfirmation(null);
                      fetchSlots();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    Book Another Slot
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grouped Slots View */}
        {!slotsLoading && !error && (
          <div className="space-y-10">
            {groupedSlots.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-700">No slots available for this advisor right now</p>
                <p className="text-xs text-slate-500 mt-1">Please check back later or contact the event organizers.</p>
              </div>
            ) : (
              groupedSlots.map((group, groupIdx) => (
                <section key={groupIdx} className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
                    <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{group.dayTitle}</h2>
                      <span className="text-xs text-slate-500 font-medium">
                        {group.slots.filter((s) => !s.is_booked).length} of {group.slots.length} slots available
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.slots.map((slot) => {
                      const isBooked = slot.is_booked;
                      const timeDisplay = formatSlotTime(slot.start_time, slot.end_time);

                      return (
                        <div
                          key={slot.id}
                          onClick={() => handleOpenBooking(slot)}
                          className={`relative rounded-2xl p-4 sm:p-5 transition-all duration-200 border flex flex-col justify-between ${
                            isBooked
                              ? "bg-slate-100/70 border-slate-200/80 text-slate-400 cursor-not-allowed select-none opacity-85"
                              : "bg-white border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer text-slate-800 group"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {slot.duration_minutes} min
                              </span>

                              {isBooked ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-600">
                                  Booked
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition">
                                  Available
                                </span>
                              )}
                            </div>

                            <p className={`text-base font-extrabold tracking-tight ${isBooked ? "text-slate-500" : "text-slate-900"}`}>
                              {timeDisplay}
                            </p>

                            {slot.note && (
                              <p className={`mt-2 text-xs font-medium ${isBooked ? "text-slate-400" : "text-blue-700 bg-blue-50/70 border border-blue-100 px-2.5 py-1 rounded-lg"}`}>
                                {slot.note}
                              </p>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-slate-400">SAST Time</span>
                            {!isBooked && (
                              <span className="font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                                Reserve slot &rarr;
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {/* Modal Booking Form */}
        {selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Booking with {currentAdvisor?.full_name || "OAK Advisor"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Please confirm your details to reserve this 1:1 clinic slot</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Selected Slot Summary Card */}
                <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-blue-700 text-[10px]">Session Details</span>
                    <span className="font-semibold text-slate-600 text-[11px]">With {currentAdvisor?.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-900">{formatDayHeader(selectedSlot.start_time)}</span>
                    <span className="font-extrabold text-blue-700">{formatSlotTime(selectedSlot.start_time, selectedSlot.end_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <span>{selectedSlot.duration_minutes} minutes</span>
                    {selectedSlot.note && (
                      <>
                        <span>•</span>
                        <span className="text-blue-800">{selectedSlot.note}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Submission Error Banner */}
                {submitError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Form Fields */}
                <form id="booking-form" onSubmit={handleSubmit} className="space-y-4 text-sm">
                  <div>
                    <label htmlFor="name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Tendai Moyo"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        readOnly={Boolean(authStatus?.attendee?.email)}
                        placeholder="name@organization.org"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition read-only:bg-slate-50 read-only:text-slate-500"
                      />
                    </div>
                    {authStatus?.attendee?.email && (
                      <p className="mt-1 text-[11px] text-slate-500">Bookings are made under your signed-in email.</p>
                    )}
                  </div>

                  <div ref={orgDropdownRef}>
                    <label htmlFor="organisation" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Organisation <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <button
                        id="organisation"
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={isOrgDropdownOpen}
                        onClick={() => {
                          setOrgSearch("");
                          setIsOrgDropdownOpen((open) => !open);
                        }}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-left focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition cursor-pointer"
                      >
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <span className={`block truncate ${isOtherOrg || organisation ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                          {isOtherOrg ? "Other (not listed)" : organisation || "Select your organisation"}
                        </span>
                        <ChevronDown
                          className={`absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform ${isOrgDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOrgDropdownOpen && (
                        <div className="absolute z-50 top-full mt-1.5 w-full left-0 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                          <div className="p-2 border-b border-slate-100">
                            <input
                              type="search"
                              autoFocus
                              aria-label="Search organisations"
                              placeholder="Search organisations..."
                              value={orgSearch}
                              onChange={(e) => setOrgSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (filteredOrgOptions.length === 1) selectOrganisation(filteredOrgOptions[0]);
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setIsOrgDropdownOpen(false);
                                }
                              }}
                              className="w-full h-9 rounded-lg bg-slate-50 border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                          <ul role="listbox" aria-label="Organisations" className="max-h-56 overflow-y-auto overscroll-contain py-1">
                            {orgOptionsLoading && (
                              <li className="px-3 py-3 text-xs text-slate-500 flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading organisations...
                              </li>
                            )}
                            {!orgOptionsLoading &&
                              filteredOrgOptions.map((org) => (
                                <li key={org} role="option" aria-selected={!isOtherOrg && organisation === org}>
                                  <button
                                    type="button"
                                    onClick={() => selectOrganisation(org)}
                                    className={`w-full text-left px-3 py-2 text-sm transition cursor-pointer ${
                                      !isOtherOrg && organisation === org
                                        ? "bg-blue-50 text-blue-800 font-semibold"
                                        : "text-slate-700 hover:bg-[#162E55] hover:text-white"
                                    }`}
                                  >
                                    {org}
                                  </button>
                                </li>
                              ))}
                            {!orgOptionsLoading && filteredOrgOptions.length === 0 && (
                              <li role="status" className="px-3 py-3 text-xs text-slate-500">
                                No matching organisations. Choose &quot;Other&quot; to type it in.
                              </li>
                            )}
                            <li role="option" aria-selected={isOtherOrg} className="border-t border-slate-100 mt-1 pt-1">
                              <button
                                type="button"
                                onClick={() => selectOrganisation("Other")}
                                className={`w-full text-left px-3 py-2 text-sm transition cursor-pointer ${
                                  isOtherOrg ? "bg-blue-50 text-blue-800 font-semibold" : "text-slate-700 hover:bg-[#162E55] hover:text-white"
                                }`}
                              >
                                Other (not listed)
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {isOtherOrg && (
                      <div className="relative mt-2">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          id="organisation-other"
                          type="text"
                          required
                          maxLength={150}
                          value={organisation}
                          onChange={(e) => setOrganisation(e.target.value)}
                          placeholder="Please type your organisation"
                          aria-label="Organisation name"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="message" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Discussion Topic / Question <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[11px] font-semibold ${message.length > maxMessageChars ? "text-rose-600" : "text-slate-400"}`}>
                        {message.length}/{maxMessageChars}
                      </span>
                    </div>
                    <div className="relative">
                      <MessageSquare className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <textarea
                        id="message"
                        rows={4}
                        required
                        maxLength={maxMessageChars}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Briefly describe what you would like to discuss or the question you would like to ask..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition resize-none"
                      />
                    </div>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="booking-form"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <span>Confirm Booking</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
