"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Scan, 
  Users, 
  CheckCircle2, 
  Clock, 
  Search, 
  ExternalLink, 
  Mail, 
  Phone, 
  Building2, 
  Utensils, 
  Accessibility, 
  Plane, 
  Bed, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  Check,
  Download,
  CalendarDays,
  LayoutList,
  LayoutGrid,
  X,
  ArrowLeft
} from "lucide-react";
import type { AttendeeRecord } from "@/lib/mockApi";
import { getAutoEventDay, getEventDayInfo, getHarareDateString } from "@/lib/event-days";

interface AttendanceListProps {
  attendees: AttendeeRecord[];
}

type TabType = "checkedIn" | "expected" | "pending";

const CONVENING_EVENT_DAYS = [
  { id: "all", label: "All Days", shortName: "All Days", date: "" },
  { id: "2026-11-09", label: "Day 1 (Mon, 9 Nov)", shortName: "Day 1", date: "2026-11-09" },
  { id: "2026-11-10", label: "Day 2 (Tue, 10 Nov)", shortName: "Day 2", date: "2026-11-10" },
  { id: "2026-11-11", label: "Day 3 (Wed, 11 Nov)", shortName: "Day 3", date: "2026-11-11" },
];

const getInitials = (firstName: string, lastName: string) => {
  return `${(firstName || "").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase() || "??";
};

const formatTime = (dateStr?: string | null) => {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return dateStr;
  }
};

function AttendeeFullDetails({
  attendee,
  statusInfo,
  selectedDay,
  selectedDayInfo,
  checkingInId,
  onCheckIn,
}: {
  attendee: AttendeeRecord;
  statusInfo: {
    isCheckedIn: boolean;
    checkInTime?: string | null;
    checkInDate?: string | null;
    totalDaysAttended: number;
    allCheckIns: { eventDay: string; scannedAt: string }[];
  };
  selectedDay: string;
  selectedDayInfo: { id: string; label: string; shortName: string };
  checkingInId: string | null;
  onCheckIn: (attendee: AttendeeRecord) => void;
}) {
  const isCheckedIn = statusInfo.isCheckedIn;
  const checkIns = attendee.checkIns || [];
  const day1 = checkIns.find((c) => c.eventDay === "2026-11-09");
  const day2 = checkIns.find((c) => c.eventDay === "2026-11-10");
  const day3 = checkIns.find((c) => c.eventDay === "2026-11-11");
  const otherCheckIns = checkIns.filter(
    (c) => c.eventDay !== "2026-11-09" && c.eventDay !== "2026-11-10" && c.eventDay !== "2026-11-11"
  );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="border-t border-slate-100 bg-[#F8FAFC] p-4 sm:p-5 flex flex-col gap-3.5 text-xs animate-in fade-in-50 duration-200"
    >
      {/* 1. Attendee Contact & Pass Identification */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-2 text-slate-700 min-w-0">
          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-500">Email:</span>
          <a
            href={`mailto:${attendee.email}`}
            className="truncate text-[#162E55] hover:underline"
          >
            {attendee.email}
          </a>
        </div>

        {attendee.phone ? (
          <div className="flex items-center gap-2 text-slate-700 min-w-0">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-500">Phone:</span>
            <a
              href={`tel:${attendee.phone}`}
              className="text-[#162E55] hover:underline truncate"
            >
              {attendee.phone}
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span>No phone provided</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
          <span className="font-semibold text-slate-500">Event Pass Code:</span>
          <code className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-bold text-[#162E55]">
            {attendee.registrationId}
          </code>
        </div>
      </div>

      {/* 2. Special Requirements: Dietary, Travel, Accommodation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
        {/* Dietary */}
        {(() => {
          const dietary = attendee.dietaryRequirements || (attendee as any).dietary;
          const travelNeeds = attendee.travelRequirements || (attendee as any).travelNeeds;
          const accommodation = attendee.accommodationRequirements || (attendee as any).accommodation;
          const accessibility = attendee.accessibilityRequirements || (attendee as any).accessibility;

          return (
            <>
              <div className="flex items-start gap-2 text-slate-700">
                <Utensils className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-500 block">Dietary:</span>
                  <span className={dietary && dietary !== "None" ? "font-bold text-amber-900" : "text-slate-600"}>
                    {dietary || "None specified"}
                  </span>
                </div>
              </div>

              {/* Travel & Transport */}
              <div className="flex items-start gap-2 text-slate-700">
                <Plane className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-500 block">Transport Logistics:</span>
                  <span className="text-slate-600">
                    {travelNeeds || "None requested"}
                  </span>
                </div>
              </div>

              {/* Accommodation */}
              {accommodation && (
                <div className="flex items-start gap-2 text-slate-700 sm:col-span-2 border-t border-slate-100 pt-2">
                  <Bed className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-500">Accommodation: </span>
                    <span className="text-slate-700">{accommodation}</span>
                  </div>
                </div>
              )}

              {/* Accessibility */}
              {accessibility && (
                <div className="flex items-start gap-2 text-slate-700 sm:col-span-2 border-t border-slate-100 pt-2">
                  <Accessibility className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-500">Accessibility: </span>
                    <span className="text-slate-700">{accessibility}</span>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* 3. Day-by-Day Attendance History */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#162E55]" />
            Convening Attendance Record
          </span>
          <span className="text-[11px] font-bold text-slate-500">
            {statusInfo.totalDaysAttended} / 3 days attended
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Day 1 */}
          <div
            className={`p-2 rounded-lg border text-[11px] flex flex-col justify-between ${
              day1
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>Day 1 (Mon 9 Nov)</span>
              {day1 ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <span className="text-slate-400 font-normal">—</span>
              )}
            </div>
            <div className="mt-1 text-[10px]">
              {day1 ? (
                <span className="font-semibold text-emerald-700">
                  Scanned: {formatTime(day1.scannedAt)}
                </span>
              ) : (
                <span className="text-slate-400">Not checked in</span>
              )}
            </div>
          </div>

          {/* Day 2 */}
          <div
            className={`p-2 rounded-lg border text-[11px] flex flex-col justify-between ${
              day2
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>Day 2 (Tue 10 Nov)</span>
              {day2 ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <span className="text-slate-400 font-normal">—</span>
              )}
            </div>
            <div className="mt-1 text-[10px]">
              {day2 ? (
                <span className="font-semibold text-emerald-700">
                  Scanned: {formatTime(day2.scannedAt)}
                </span>
              ) : (
                <span className="text-slate-400">Not checked in</span>
              )}
            </div>
          </div>

          {/* Day 3 */}
          <div
            className={`p-2 rounded-lg border text-[11px] flex flex-col justify-between ${
              day3
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span>Day 3 (Wed 11 Nov)</span>
              {day3 ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <span className="text-slate-400 font-normal">—</span>
              )}
            </div>
            <div className="mt-1 text-[10px]">
              {day3 ? (
                <span className="font-semibold text-emerald-700">
                  Scanned: {formatTime(day3.scannedAt)}
                </span>
              ) : (
                <span className="text-slate-400">Not checked in</span>
              )}
            </div>
          </div>
        </div>

        {/* Other check-in dates (e.g. testing) */}
        {otherCheckIns.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
            <span className="font-semibold">Additional Scans:</span>
            {otherCheckIns.map((c, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px]">
                {c.eventDay}: {formatTime(c.scannedAt)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 4. Action Controls */}
      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
        <Link
          href={`/pass/${attendee.registrationId}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#162E55] font-bold text-xs shadow-2xs transition"
        >
          <span>Open Full Pass / Ticket</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </Link>

        {!isCheckedIn && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCheckIn(attendee);
            }}
            disabled={checkingInId === attendee.registrationId}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {checkingInId === attendee.registrationId ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking in...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>
                  Check In {selectedDay !== "all" ? `(${selectedDayInfo.shortName})` : `(${getEventDayInfo(getAutoEventDay()).shortName})`}
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function AttendanceList({ attendees }: AttendanceListProps) {
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabType>("checkedIn");
  const [isDrilldown, setIsDrilldown] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("oak_attendance_view_mode");
      if (saved === "cards" || saved === "list") return saved;
    }
    return "list";
  });

  const handleToggleViewMode = (mode: "list" | "cards") => {
    setViewMode(mode);
    try {
      localStorage.setItem("oak_attendance_view_mode", mode);
    } catch {}
  };

  const autoDetectedDay = getAutoEventDay();
  const todayHarare = getHarareDateString();

  // Discover any additional dates present in check-ins (e.g. today's testing date)
  const availableDays = useMemo(() => {
    const days = [...CONVENING_EVENT_DAYS];
    const recordedDays = new Set<string>();
    
    attendees.forEach((a) => {
      (a.checkIns || []).forEach((c) => {
        if (c.eventDay) recordedDays.add(c.eventDay);
      });
      if (a.checkInDate) recordedDays.add(a.checkInDate);
    });

    const standardDates = new Set(["2026-11-09", "2026-11-10", "2026-11-11"]);
    const todayStr = getHarareDateString();

    if (!standardDates.has(todayStr) && !recordedDays.has(todayStr)) {
      recordedDays.add(todayStr);
    }

    recordedDays.forEach((dateStr) => {
      if (!standardDates.has(dateStr)) {
        const isToday = dateStr === todayStr;
        days.push({
          id: dateStr,
          label: isToday ? `Today (${dateStr})` : `Test Day (${dateStr})`,
          shortName: isToday ? "Today" : dateStr,
          date: dateStr,
        });
      }
    });

    return days;
  }, [attendees]);

  // Map each attendee's status for the currently selected event day
  const getAttendeeDayStatus = (attendee: AttendeeRecord) => {
    const allCheckIns = attendee.checkIns || [];
    const totalDaysAttended = allCheckIns.length > 0 
      ? allCheckIns.length 
      : attendee.attendanceStatus === "Checked In" 
      ? 1 
      : 0;

    if (selectedDay === "all") {
      const hasCheckedIn = allCheckIns.length > 0 || attendee.attendanceStatus === "Checked In";
      const latestCheckIn = allCheckIns[allCheckIns.length - 1];
      return {
        isCheckedIn: hasCheckedIn,
        checkInTime: latestCheckIn?.scannedAt || attendee.checkInTime,
        checkInDate: latestCheckIn?.eventDay || attendee.checkInDate,
        totalDaysAttended,
        allCheckIns,
      };
    }

    const match = allCheckIns.find((c) => c.eventDay === selectedDay);
    if (!match && (attendee.checkInDate === selectedDay || (!attendee.checkInDate && selectedDay === autoDetectedDay))) {
      if (attendee.attendanceStatus === "Checked In") {
        return {
          isCheckedIn: true,
          checkInTime: attendee.checkInTime,
          checkInDate: selectedDay,
          totalDaysAttended,
          allCheckIns,
        };
      }
    }

    return {
      isCheckedIn: Boolean(match),
      checkInTime: match?.scannedAt || null,
      checkInDate: match?.eventDay || null,
      totalDaysAttended,
      allCheckIns,
    };
  };

  // Precompute day breakdown stats
  const dayStats = useMemo(() => {
    const stats: Record<string, number> = {};
    attendees.forEach((a) => {
      const checkIns = a.checkIns || [];
      if (checkIns.length > 0) {
        checkIns.forEach((c) => {
          if (c.eventDay) {
            stats[c.eventDay] = (stats[c.eventDay] || 0) + 1;
          }
        });
      } else if (a.attendanceStatus === "Checked In") {
        const d = a.checkInDate || autoDetectedDay;
        stats[d] = (stats[d] || 0) + 1;
      }
    });
    return stats;
  }, [attendees, autoDetectedDay]);

  const expectedCount = attendees.length;
  const checkedInAttendees = useMemo(() => {
    return attendees.filter((a) => getAttendeeDayStatus(a).isCheckedIn);
  }, [attendees, selectedDay]);

  const pendingAttendees = useMemo(() => {
    return attendees.filter((a) => !getAttendeeDayStatus(a).isCheckedIn);
  }, [attendees, selectedDay]);

  const checkedInCount = checkedInAttendees.length;
  const pendingCount = pendingAttendees.length;

  // Filter attendees by category
  const categoryAttendees = useMemo(() => {
    switch (activeTab) {
      case "checkedIn":
        return checkedInAttendees;
      case "pending":
        return pendingAttendees;
      case "expected":
      default:
        return attendees;
    }
  }, [activeTab, attendees, checkedInAttendees, pendingAttendees]);

  // Apply search query
  const filteredAttendees = useMemo(() => {
    if (!searchQuery.trim()) return categoryAttendees;
    const q = searchQuery.toLowerCase().trim();
    return categoryAttendees.filter((a) => {
      const name = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
      const org = (a.organization || "").toLowerCase();
      const sub = (a.subPartnerProgramArea || "").toLowerCase();
      const email = (a.email || "").toLowerCase();
      const code = (a.registrationId || "").toLowerCase();
      const role = (a.role || "").toLowerCase();
      return (
        name.includes(q) ||
        org.includes(q) ||
        sub.includes(q) ||
        email.includes(q) ||
        code.includes(q) ||
        role.includes(q)
      );
    });
  }, [categoryAttendees, searchQuery]);

  // Quick manual check-in handler for the currently selected day
  const handleQuickCheckIn = async (attendee: AttendeeRecord) => {
    const code = attendee.registrationId;
    if (!code || checkingInId) return;

    setCheckingInId(code);
    const dayToUse = selectedDay !== "all" ? selectedDay : autoDetectedDay;

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, eventDay: dayToUse }),
      });

      if (res.ok) {
        window.dispatchEvent(new Event("oak-attendance-update"));
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to check in attendee. Please try again.");
      }
    } catch (err: any) {
      console.error("Manual check in error:", err);
      alert(err.message || "Failed to check in attendee.");
    } finally {
      setCheckingInId(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Grantee":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Presenter":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Observer":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "OAK Staff":
      case "Coordination Team":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const selectedDayInfo = availableDays.find((d) => d.id === selectedDay) || availableDays[0];

  // Check if we should render the clean Empty State matching the screenshot
  const showEmptyCheckinsState =
    (!isDrilldown && checkedInCount === 0) ||
    (isDrilldown && activeTab === "checkedIn" && checkedInCount === 0 && !searchQuery);

  const renderEventOverviewCard = () => (
    <section className="w-full rounded-[24px] sm:rounded-[28px] bg-white p-5 sm:p-6 border border-[#1C2E5A1A] shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D]">
      <div className="flex items-center justify-between mb-3.5 px-0.5">
        <h2 className="font-sans text-[10px] font-bold uppercase tracking-[1.5px] text-[#8F9BA8]">
          EVENT OVERVIEW
        </h2>
        {isDrilldown && (
          <span className="text-[11px] font-semibold text-slate-400">
            Viewing: <strong className="text-[#162E55] capitalize">{activeTab === "checkedIn" ? "Checked In" : activeTab}</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {/* Expected */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("expected");
            setIsDrilldown(true);
            setSearchQuery("");
          }}
          className={`flex flex-col items-center justify-center rounded-[18px] py-4 px-2 transition-all cursor-pointer select-none active:scale-[0.98] ${
            isDrilldown && activeTab === "expected"
              ? "bg-white ring-2 ring-[#162E55] shadow-xs"
              : "bg-[#EEF1F5] hover:bg-[#E5EAEF]"
          }`}
        >
          <p
            className="text-[26px] sm:text-[30px] font-extrabold leading-none text-[#0E1726] mb-1.5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {expectedCount}
          </p>
          <p className="font-sans text-[11px] sm:text-[12px] font-medium text-[#6B7590]">
            Expected
          </p>
        </button>

        {/* Checked In */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("checkedIn");
            setIsDrilldown(true);
            setSearchQuery("");
          }}
          className={`flex flex-col items-center justify-center rounded-[18px] py-4 px-2 transition-all cursor-pointer select-none active:scale-[0.98] ${
            isDrilldown && activeTab === "checkedIn"
              ? "bg-white ring-2 ring-[#162E55] shadow-xs"
              : "bg-[#EEF1F5] hover:bg-[#E5EAEF]"
          }`}
        >
          <p
            className="text-[26px] sm:text-[30px] font-extrabold leading-none text-[#0E1726] mb-1.5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {checkedInCount}
          </p>
          <p className="font-sans text-[11px] sm:text-[12px] font-medium text-[#6B7590]">
            Checked In
          </p>
        </button>

        {/* Pending */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("pending");
            setIsDrilldown(true);
            setSearchQuery("");
          }}
          className={`flex flex-col items-center justify-center rounded-[18px] py-4 px-2 transition-all cursor-pointer select-none active:scale-[0.98] ${
            isDrilldown && activeTab === "pending"
              ? "bg-white ring-2 ring-[#162E55] shadow-xs"
              : "bg-[#EEF1F5] hover:bg-[#E5EAEF]"
          }`}
        >
          <p
            className="text-[26px] sm:text-[30px] font-extrabold leading-none text-[#0E1726] mb-1.5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {pendingCount}
          </p>
          <p className="font-sans text-[11px] sm:text-[12px] font-medium text-[#6B7590]">
            Pending
          </p>
        </button>
      </div>
    </section>
  );

  const renderMainCard = () => (
    <section className="w-full rounded-[28px] sm:rounded-[32px] bg-white border border-[#1C2E5A1A] shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D] overflow-hidden transition-all">
      {showEmptyCheckinsState ? (
        /* Empty State: Matches the user's uploaded mockup directly */
        <div className="py-12 sm:py-16 px-6 flex flex-col items-center justify-center text-center">
          {/* Soft squircle icon wrapper */}
          <div className="w-20 h-20 rounded-[24px] bg-[#EEF2F6] flex items-center justify-center text-[#8FA0B5] mb-5 shadow-2xs">
            <Users className="w-9 h-9 text-[#8FA0B5]" strokeWidth={1.75} />
          </div>

          {/* Main title */}
          <h2
            className="text-[20px] sm:text-[22px] font-bold text-[#0E1726] mb-2"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            No check-ins yet
          </h2>

          {/* Subtext description */}
          <p className="text-[14px] text-[#6B7590] max-w-[340px] leading-relaxed mb-6 font-sans">
            Attendees will appear here once they have been scanned in at the event entrance.
          </p>

          {/* Primary Action Button */}
          <Link
            href="/admin/scan"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[16px] bg-[#162E55] hover:bg-[#1C2E5A] text-white text-[14px] font-bold shadow-[0_4px_16px_0_#1C2E5A4D] transition-all active:scale-[0.98] cursor-pointer font-sans"
          >
            <Scan className="w-4 h-4 text-white" />
            <span>Go to Check-In Scanner</span>
          </Link>

          {/* Optional subtle day selector if user wants to check past days */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap justify-center text-xs">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Filter Day:</span>
            {availableDays.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDay(d.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedDay === d.id
                    ? "bg-[#162E55] text-white"
                    : "bg-[#F4F6F8] text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d.shortName}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Active Content State: When viewing Expected, Pending, Search, or Checked In attendees */
        <div className="p-5 sm:p-6 flex flex-col">
          {/* Top Bar: Title & Day Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] sm:text-[18px] font-bold text-[#0E1726]">
                  {activeTab === "expected" && "Expected Attendees"}
                  {activeTab === "checkedIn" && (selectedDay === "all" ? "Checked In (All Days)" : `Checked In (${selectedDayInfo.shortName})`)}
                  {activeTab === "pending" && (selectedDay === "all" ? "Pending Check-In" : `Pending (${selectedDayInfo.shortName})`)}
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {filteredAttendees.length}
                </span>
              </div>
              <p className="text-xs text-[#6B7590] mt-0.5">
                {activeTab === "expected" && "All registered convening delegates"}
                {activeTab === "checkedIn" && `Participants present on ${selectedDayInfo.label}`}
                {activeTab === "pending" && `Participants awaiting check-in on ${selectedDayInfo.label}`}
              </p>
            </div>

            {/* Action buttons: Scanner and CSV export */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <a
                href="/api/attendees/export"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                title="Export Attendance to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </a>
              <Link
                href="/admin/scan"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#162E55] hover:bg-[#1C2E5A] text-white text-xs font-semibold shadow-xs transition"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Scanner</span>
              </Link>
            </div>
          </div>

          {/* Day Selector Segmented Tabs */}
          <div className="pt-3 pb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#F4F6F8] p-1 rounded-xl">
              {availableDays.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDay(d.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    selectedDay === d.id
                      ? "bg-white text-[#162E55] shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {d.shortName}
                </button>
              ))}
            </div>

            {selectedDay !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedDay("all")}
                className="text-xs font-semibold text-[#162E55] hover:underline cursor-pointer"
              >
                View All Days
              </button>
            )}
          </div>

          {/* Search Input & List/Cards View Toggle */}
          <div className="py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                placeholder="Search by name, organization, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#F4F6F8] border border-slate-200/70 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#162E55]/15 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-[#F4F6F8] p-1 rounded-xl shrink-0 self-end sm:self-auto border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleToggleViewMode("list")}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white text-[#162E55] shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="List View"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode("cards")}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-[#162E55] shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>
          </div>

          {/* List / Cards Content */}
          {filteredAttendees.length === 0 ? (
            <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF2F6] text-slate-400 flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#0E1726] mb-1">
                No matching attendees found
              </h3>
              <p className="text-xs text-[#6B7590] max-w-xs mb-3">
                No attendees matched &quot;{searchQuery}&quot;. Try adjusting your filter or search query.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                Clear Search
              </button>
            </div>
          ) : viewMode === "list" ? (
            /* LIST VIEW */
            <ul className="flex flex-col gap-2 pt-2">
              {filteredAttendees.map((attendee) => {
                const statusInfo = getAttendeeDayStatus(attendee);
                const isCheckedIn = statusInfo.isCheckedIn;
                const isExpanded = expandedId === attendee.registrationId;

                const checkIns = attendee.checkIns || [];
                const day1 = checkIns.find((c) => c.eventDay === "2026-11-09");
                const day2 = checkIns.find((c) => c.eventDay === "2026-11-10");
                const day3 = checkIns.find((c) => c.eventDay === "2026-11-11");

                return (
                  <li
                    key={attendee.registrationId}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? "border-[#162E55] ring-1 ring-[#162E55]/20 bg-white shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-300 hover:shadow-2xs"
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : attendee.registrationId)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(isExpanded ? null : attendee.registrationId);
                        }
                      }}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      {/* Avatar & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#162E55] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {getInitials(attendee.firstName, attendee.lastName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#0E1726] text-sm truncate">
                              {attendee.firstName} {attendee.lastName}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(
                                attendee.role
                              )}`}
                            >
                              {attendee.role}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B7590] truncate flex items-center gap-1 mt-0.5">
                            <span>{attendee.organization}</span>
                            {attendee.subPartnerProgramArea && (
                              <span className="text-slate-400">
                                • {attendee.subPartnerProgramArea}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right: Days chips, status & chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              day1 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                            }`}
                            title={day1 ? `Day 1: ${formatTime(day1.scannedAt)}` : "Day 1: Pending"}
                          >
                            D1
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              day2 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                            }`}
                            title={day2 ? `Day 2: ${formatTime(day2.scannedAt)}` : "Day 2: Pending"}
                          >
                            D2
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              day3 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                            }`}
                            title={day3 ? `Day 3: ${formatTime(day3.scannedAt)}` : "Day 3: Pending"}
                          >
                            D3
                          </span>
                        </div>

                        {isCheckedIn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Checked In</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}

                        <div className="w-6 h-6 flex items-center justify-center text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#162E55]" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Full Info Drawer */}
                    {isExpanded && (
                      <AttendeeFullDetails
                        attendee={attendee}
                        statusInfo={statusInfo}
                        selectedDay={selectedDay}
                        selectedDayInfo={selectedDayInfo}
                        checkingInId={checkingInId}
                        onCheckIn={handleQuickCheckIn}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            /* CARDS VIEW */
            <ul className="flex flex-col gap-3 pt-2">
              {filteredAttendees.map((attendee) => {
                const statusInfo = getAttendeeDayStatus(attendee);
                const isCheckedIn = statusInfo.isCheckedIn;
                const isExpanded = expandedId === attendee.registrationId;

                const checkIns = attendee.checkIns || [];
                const day1 = checkIns.find((c) => c.eventDay === "2026-11-09");
                const day2 = checkIns.find((c) => c.eventDay === "2026-11-10");
                const day3 = checkIns.find((c) => c.eventDay === "2026-11-11");

                return (
                  <li
                    key={attendee.registrationId}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? "border-[#162E55] ring-1 ring-[#162E55]/20 bg-white shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-300 hover:shadow-2xs"
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : attendee.registrationId)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(isExpanded ? null : attendee.registrationId);
                        }
                      }}
                      className="p-4 flex flex-col gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#162E55] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                            {getInitials(attendee.firstName, attendee.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#0E1726] text-sm truncate">
                                {attendee.firstName} {attendee.lastName}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(
                                  attendee.role
                                )}`}
                              >
                                {attendee.role}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B7590] truncate flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{attendee.organization}</span>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isCheckedIn ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Checked In</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Daily breakdown strip */}
                      <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-slate-50 text-[11px]">
                        <span className="text-slate-400 font-semibold text-[10px] uppercase mr-1">
                          Days:
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${day1 ? "bg-emerald-100 text-emerald-800 font-semibold" : "bg-slate-200/60 text-slate-500"}`}>
                          {day1 ? "✓ Day 1" : "— Day 1"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${day2 ? "bg-emerald-100 text-emerald-800 font-semibold" : "bg-slate-200/60 text-slate-500"}`}>
                          {day2 ? "✓ Day 2" : "— Day 2"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${day3 ? "bg-emerald-100 text-emerald-800 font-semibold" : "bg-slate-200/60 text-slate-500"}`}>
                          {day3 ? "✓ Day 3" : "— Day 3"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                        <span className="truncate max-w-[200px]">{attendee.email}</span>
                        <span className="text-[11px] font-semibold text-[#162E55] flex items-center gap-1">
                          {isExpanded ? "Hide Details" : "View Full Details"}
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                    </div>

                    {/* Full Info Drawer */}
                    {isExpanded && (
                      <AttendeeFullDetails
                        attendee={attendee}
                        statusInfo={statusInfo}
                        selectedDay={selectedDay}
                        selectedDayInfo={selectedDayInfo}
                        checkingInId={checkingInId}
                        onCheckIn={handleQuickCheckIn}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );

  return (
    <div className="w-full space-y-5">
      {!isDrilldown ? (
        /* Default Overview: Matches screenshot directly */
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          {renderMainCard()}
          {renderEventOverviewCard()}
        </div>
      ) : (
        /* Drilldown Category View: Includes Back button, keeps 3 tabs at top, and renders list */
        <>
          {/* Back button & quick navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsDrilldown(false);
                setActiveTab("checkedIn");
                setSearchQuery("");
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-[#162E55] hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Overview</span>
            </button>

            <div className="flex items-center gap-2">
              <a
                href="/api/attendees/export"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
                title="Export Attendance to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </a>
              <Link
                href="/admin/scan"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#162E55] hover:bg-[#1C2E5A] text-white text-xs font-semibold shadow-xs transition"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Scanner</span>
              </Link>
            </div>
          </div>

          {/* Three Tabs are STILL VISIBLE at the top! */}
          {renderEventOverviewCard()}

          {/* Main Card with attendees in the selected tab */}
          {renderMainCard()}
        </>
      )}
    </div>
  );
}
