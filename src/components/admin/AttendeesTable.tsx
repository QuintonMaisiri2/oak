'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Search,
  Download,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Calendar,
  Trash2,
  Loader2,
  AlertCircle,
  Users,
  Building2,
  Utensils,
  Accessibility,
  Plane,
  X,
  Printer,
  Scan,
  Shield,
  Eye,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  Copy,
  Check,
  Mail,
  Phone,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  UserCheck,
  UserX,
  Hotel,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { Attendee } from '@/lib/types/domain';

interface AttendeesTableProps {
  initialAttendees: Attendee[];
  checkedInIds: string[];
  checkInDaysMap?: Record<string, string[]>;
  checkInHistoryMap?: Record<string, { eventDay: string; scannedAt: string }[]>;
  isSuperAdmin?: boolean;
  activeEventDay?: string;
}

const CONVENING_DAYS = [
  { id: 'All', label: 'All Days', short: 'All Days' },
  { id: '2026-11-09', label: 'Day 1 (Mon, 9 Nov)', short: 'Day 1 · 9 Nov' },
  { id: '2026-11-10', label: 'Day 2 (Tue, 10 Nov)', short: 'Day 2 · 10 Nov' },
  { id: '2026-11-11', label: 'Day 3 (Wed, 11 Nov)', short: 'Day 3 · 11 Nov' },
];

const ROLES = ['All', 'Grantee', 'OAK Staff', 'Coordination Team', 'Presenter', 'Observer'];

const ROLE_BADGES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Grantee: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-600' },
  'OAK Staff': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-600' },
  'Coordination Team': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-600' },
  Presenter: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-600' },
  Observer: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
};

function getInitials(firstName?: string, lastName?: string, fallbackName?: string): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (fallbackName) {
    const parts = fallbackName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return '??';
}

function formatHarareTime(isoString?: string | null): string {
  if (!isoString) return 'Pending';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatFullDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function AttendeesTable({
  initialAttendees,
  checkedInIds: initialCheckedInIds,
  checkInDaysMap: initialCheckInDaysMap = {},
  checkInHistoryMap: initialCheckInHistoryMap = {},
  isSuperAdmin = false,
  activeEventDay = '2026-11-09',
}: AttendeesTableProps) {
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees);
  const [checkInDays, setCheckInDays] = useState<Record<string, string[]>>(initialCheckInDaysMap);
  const [checkInHistory, setCheckInHistory] = useState<Record<string, { eventDay: string; scannedAt: string }[]>>(
    initialCheckInHistoryMap
  );

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedDay, setSelectedDay] = useState(activeEventDay || 'All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'checkedIn' | 'pending'>('All');
  const [selectedLogistics, setSelectedLogistics] = useState<'All' | 'specialNeeds' | 'dietary' | 'accessibility' | 'travel'>('All');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'org-asc' | 'status' | 'newest'>('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals & Drawers
  const [detailAttendee, setDetailAttendee] = useState<Attendee | null>(null);
  const [deletingAttendee, setDeletingAttendee] = useState<Attendee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedEventCode, setCopiedEventCode] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync with initial props if they change
  useEffect(() => {
    setAttendees(initialAttendees);
    setCheckInDays(initialCheckInDaysMap);
    setCheckInHistory(initialCheckInHistoryMap);
  }, [initialAttendees, initialCheckInDaysMap, initialCheckInHistoryMap]);

  // Target day for evaluating "Checked In" status
  const targetDay = selectedDay !== 'All' ? selectedDay : activeEventDay;

  // Keyboard shortcut listener: press "/" to focus search, "Escape" to close drawer/modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !(e.target as HTMLElement)?.matches('input, textarea')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (detailAttendee) setDetailAttendee(null);
        if (deletingAttendee) setDeletingAttendee(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailAttendee, deletingAttendee]);

  // Live Refresh handler
  const handleLiveRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/attendees?day=${encodeURIComponent(targetDay)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch attendee records');
      const data = await res.json();
      if (Array.isArray(data)) {
        const mappedAttendees: Attendee[] = data.map((a: any) => ({
          id: a.registrationId || a.id,
          eventCode: a.registrationId || a.eventCode || a.qrCodeId,
          firstName: a.firstName,
          lastName: a.lastName,
          name: `${a.firstName || ''} ${a.lastName || ''}`.trim(),
          organization: a.organization,
          subPartner: a.subPartnerProgramArea,
          role: a.role,
          email: a.email,
          phone: a.phone,
          dietary: a.dietaryRequirements,
          accessibility: a.accessibilityRequirements,
          travelNeeds: a.travelRequirements,
          accommodation: a.accommodationRequirements,
          consentGivenAt: a.consentGivenAt || a.registrationDate || new Date().toISOString(),
          createdAt: a.registrationDate,
        }));

        const newDaysMap: Record<string, string[]> = {};
        const newHistoryMap: Record<string, { eventDay: string; scannedAt: string }[]> = {};

        data.forEach((a: any) => {
          const id = a.registrationId || a.id;
          const checkIns = a.checkIns || [];
          newDaysMap[id] = checkIns.map((c: any) => c.eventDay);
          newHistoryMap[id] = checkIns.map((c: any) => ({
            eventDay: c.eventDay,
            scannedAt: c.scannedAt,
          }));
        });

        setAttendees(mappedAttendees);
        setCheckInDays(newDaysMap);
        setCheckInHistory(newHistoryMap);

        setNotification({
          type: 'info',
          message: `Roster refreshed · ${mappedAttendees.length} participants loaded.`,
        });
      }
    } catch (err: any) {
      console.error('Refresh error:', err);
      setNotification({
        type: 'error',
        message: 'Could not refresh roster. Please check your internet connection.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [targetDay]);

  // Handle 1-Click Manual Check-In / Undo Check-In
  const handleToggleCheckIn = async (attendee: Attendee, specificDay?: string) => {
    const dayToToggle = specificDay || targetDay;
    const currentDays = checkInDays[attendee.id] || [];
    const isCurrentlyChecked = currentDays.includes(dayToToggle);

    setActionLoadingId(`${attendee.id}-${dayToToggle}`);
    setNotification(null);

    try {
      if (isCurrentlyChecked) {
        // Undo Check-in
        const res = await fetch('/api/check-in', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: attendee.eventCode || attendee.id,
            eventDay: dayToToggle,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to undo check-in');

        // Optimistically update local state
        setCheckInDays((prev) => ({
          ...prev,
          [attendee.id]: (prev[attendee.id] || []).filter((d) => d !== dayToToggle),
        }));
        setCheckInHistory((prev) => ({
          ...prev,
          [attendee.id]: (prev[attendee.id] || []).filter((h) => h.eventDay !== dayToToggle),
        }));

        setNotification({
          type: 'info',
          message: `Check-in reversed for ${attendee.name} on ${CONVENING_DAYS.find((d) => d.id === dayToToggle)?.short || dayToToggle}.`,
        });
      } else {
        // Perform Check-in
        const res = await fetch('/api/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: attendee.eventCode || attendee.id,
            eventDay: dayToToggle,
            scannedAt: new Date().toISOString(),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete check-in');

        const scannedAt = data.checkIn?.scannedAt || new Date().toISOString();

        // Optimistically update local state
        setCheckInDays((prev) => {
          const list = prev[attendee.id] || [];
          return list.includes(dayToToggle) ? prev : { ...prev, [attendee.id]: [...list, dayToToggle] };
        });
        setCheckInHistory((prev) => {
          const list = prev[attendee.id] || [];
          return list.some((h) => h.eventDay === dayToToggle)
            ? prev
            : { ...prev, [attendee.id]: [...list, { eventDay: dayToToggle, scannedAt }] };
        });

        setNotification({
          type: 'success',
          message: `✓ ${attendee.name} successfully checked in for ${CONVENING_DAYS.find((d) => d.id === dayToToggle)?.short || dayToToggle}!`,
        });
      }

      window.dispatchEvent(new CustomEvent('oak-attendance-update'));
    } catch (err: any) {
      console.error('Check-in error:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Operation failed. Please try again.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter & Sort Attendees
  const filteredAndSortedAttendees = useMemo(() => {
    const list = attendees.filter((a) => {
      // Role filter
      if (selectedRole !== 'All' && a.role !== selectedRole) return false;

      const days = checkInDays[a.id] || [];

      // Day filter
      if (selectedDay !== 'All' && !days.includes(selectedDay)) {
        if (selectedStatus === 'checkedIn') return false;
      }

      // Status filter
      const isCheckedInForTarget = days.includes(targetDay);
      if (selectedStatus === 'checkedIn' && !isCheckedInForTarget) return false;
      if (selectedStatus === 'pending' && isCheckedInForTarget) return false;

      // Logistics filter
      if (selectedLogistics === 'specialNeeds') {
        const hasNeeds = Boolean(a.dietary || a.accessibility || a.travelNeeds || a.accommodation);
        if (!hasNeeds) return false;
      } else if (selectedLogistics === 'dietary') {
        if (!a.dietary) return false;
      } else if (selectedLogistics === 'accessibility') {
        if (!a.accessibility) return false;
      } else if (selectedLogistics === 'travel') {
        if (!a.travelNeeds && !a.accommodation) return false;
      }

      // Search query
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = (a.name || '').toLowerCase().includes(term);
        const matchesOrg = (a.organization || '').toLowerCase().includes(term);
        const matchesSubPartner = (a.subPartner || '').toLowerCase().includes(term);
        const matchesEmail = (a.email || '').toLowerCase().includes(term);
        const matchesCode = (a.eventCode || '').toLowerCase().includes(term);
        const matchesPhone = (a.phone || '').toLowerCase().includes(term);

        if (!matchesName && !matchesOrg && !matchesSubPartner && !matchesEmail && !matchesCode && !matchesPhone) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'org-asc') {
        return (a.organization || '').localeCompare(b.organization || '');
      }
      if (sortBy === 'status') {
        const aChecked = (checkInDays[a.id] || []).includes(targetDay);
        const bChecked = (checkInDays[b.id] || []).includes(targetDay);
        if (aChecked && !bChecked) return -1;
        if (!aChecked && bChecked) return 1;
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'newest') {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }
      return 0;
    });
  }, [attendees, selectedRole, selectedDay, selectedStatus, selectedLogistics, searchTerm, checkInDays, targetDay, sortBy]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole, selectedDay, selectedStatus, selectedLogistics, sortBy]);

  // Pagination calculation
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredAndSortedAttendees.length / pageSize);
  const paginatedAttendees = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedAttendees;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedAttendees.slice(start, start + pageSize);
  }, [filteredAndSortedAttendees, currentPage, pageSize]);

  // Key KPI Metrics
  const stats = useMemo(() => {
    const total = attendees.length;
    let checkedInTarget = 0;
    let grantees = 0;
    let staff = 0;
    let specialNeeds = 0;
    let dietaryCount = 0;

    attendees.forEach((a) => {
      const days = checkInDays[a.id] || [];
      if (days.includes(targetDay)) {
        checkedInTarget++;
      }
      if (a.role === 'Grantee') grantees++;
      if (a.role === 'OAK Staff' || a.role === 'Coordination Team') staff++;
      if (a.dietary || a.accessibility || a.travelNeeds || a.accommodation) {
        specialNeeds++;
      }
      if (a.dietary) dietaryCount++;
    });

    const pendingTarget = total - checkedInTarget;
    const rate = total > 0 ? Math.round((checkedInTarget / total) * 100) : 0;

    return {
      total,
      checkedInTarget,
      pendingTarget,
      rate,
      grantees,
      staff,
      specialNeeds,
      dietaryCount,
    };
  }, [attendees, checkInDays, targetDay]);

  // Handle Delete Attendee (Super Admin only)
  const handleConfirmDelete = async () => {
    if (!deletingAttendee || !isSuperAdmin) return;

    setIsDeleting(true);
    setNotification(null);

    try {
      const res = await fetch(`/api/attendees/${encodeURIComponent(deletingAttendee.id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete attendee');
      }

      setAttendees((prev) => prev.filter((a) => a.id !== deletingAttendee.id));
      if (detailAttendee?.id === deletingAttendee.id) {
        setDetailAttendee(null);
      }
      setNotification({
        type: 'success',
        message: data.message || `Attendee "${deletingAttendee.name}" was successfully deleted.`,
      });
      setDeletingAttendee(null);
    } catch (err: any) {
      console.error('Error deleting attendee:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Failed to delete attendee.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyEventCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedEventCode(code);
    setTimeout(() => setCopiedEventCode(null), 2200);
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedRole !== 'All' ||
    selectedDay !== 'All' ||
    selectedStatus !== 'All' ||
    selectedLogistics !== 'All';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedRole('All');
    setSelectedDay('All');
    setSelectedStatus('All');
    setSelectedLogistics('All');
    setSortBy('name-asc');
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#111C33] via-[#16284D] to-[#1C2C4F] text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-white/10 text-white border border-white/15 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Coordination Roster
              </span>
              <span className="text-[11px] font-semibold text-slate-300">
                Oak Grantee Convening 2026 · Harare, Zimbabwe
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Registered Attendees</span>
              <span className="text-sm sm:text-base font-bold px-3 py-1 rounded-full bg-white/15 text-white border border-white/20">
                {attendees.length} Total
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Verify convening credentials, track real-time attendance across Days 1–3, monitor dietary & logistics requirements, and coordinate guest entry seamlessly.
            </p>
          </div>

          {/* Quick Action Shortcuts Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start lg:self-center">
            <Link
              href="/admin/scan"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#111C33] hover:bg-slate-100 text-xs font-bold shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Scan className="w-4 h-4 text-blue-600" />
              <span>QR Scanner</span>
            </Link>

            <Link
              href="/admin/nametags"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition transform active:scale-95"
            >
              <Printer className="w-4 h-4 text-slate-200" />
              <span>Print Badges</span>
            </Link>

            <a
              href="/api/attendees/export"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition transform active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </a>

            <button
              type="button"
              onClick={handleLiveRefresh}
              disabled={isRefreshing}
              title="Refresh roster data"
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          role="alert"
          className={`flex items-center justify-between p-4 rounded-2xl border text-xs font-semibold shadow-sm animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'info' ? (
              <RefreshCw className="h-4 w-4 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-3 cursor-pointer text-sm"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Interactive KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Roster */}
        <button
          type="button"
          onClick={() => {
            setSelectedStatus('All');
            setSelectedRole('All');
          }}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            selectedStatus === 'All' && selectedRole === 'All'
              ? 'border-[#1C2C4F] ring-2 ring-[#1C2C4F]/15 bg-slate-50/50'
              : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Roster</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#1C2C4F] group-hover:text-white transition">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{stats.total}</div>
          <div className="text-[11px] font-medium text-slate-500 mt-1">Confirmed participants</div>
        </button>

        {/* Checked In */}
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'checkedIn' ? 'All' : 'checkedIn')}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            selectedStatus === 'checkedIn'
              ? 'border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/30'
              : 'border-slate-200/90 hover:border-emerald-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Checked In</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              {stats.checkedInTarget}
            </span>
            <span className="text-xs font-bold text-emerald-600">({stats.rate}%)</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${stats.rate}%` }}
            />
          </div>
        </button>

        {/* Pending Check-in */}
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'pending' ? 'All' : 'pending')}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            selectedStatus === 'pending'
              ? 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/30'
              : 'border-slate-200/90 hover:border-amber-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight">{stats.pendingTarget}</div>
          <div className="text-[11px] font-medium text-amber-700/80 mt-1">Expected on site</div>
        </button>

        {/* Grantees */}
        <button
          type="button"
          onClick={() => setSelectedRole(selectedRole === 'Grantee' ? 'All' : 'Grantee')}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            selectedRole === 'Grantee'
              ? 'border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/30'
              : 'border-slate-200/90 hover:border-blue-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-blue-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Grantees</span>
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
              <Building2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-800 tracking-tight">{stats.grantees}</div>
          <div className="text-[11px] font-medium text-blue-600/90 mt-1">Partner delegates</div>
        </button>

        {/* Logistics & Diet */}
        <button
          type="button"
          onClick={() => setSelectedLogistics(selectedLogistics === 'specialNeeds' ? 'All' : 'specialNeeds')}
          className={`col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            selectedLogistics === 'specialNeeds'
              ? 'border-rose-500 ring-2 ring-rose-500/15 bg-rose-50/30'
              : 'border-slate-200/90 hover:border-rose-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-rose-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Special Care</span>
            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition">
              <Utensils className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-800 tracking-tight">{stats.specialNeeds}</div>
          <div className="text-[11px] font-medium text-rose-600/90 mt-1">Diet / Access / Travel</div>
        </button>
      </div>

      {/* 3. Convening Day Segmented Pills & Controls Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        {/* Top bar: Day segmented buttons & view toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
              Convening Day:
            </span>
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
              {CONVENING_DAYS.map((day) => {
                const isActive = selectedDay === day.id;
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDay(day.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#1C2C4F] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto">
            {/* View Mode Switcher */}
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table view"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-[#1C2C4F] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Card grid view"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-[#1C2C4F] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Second bar: Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, organization, pass code, email, or phone (Press / to focus)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-2xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] focus:bg-white transition"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <span className="hidden sm:block absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                /
              </span>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="h-11 appearance-none pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="checkedIn">Checked In</option>
                <option value="pending">Pending</option>
              </select>
              <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Role Dropdown */}
            <div className="relative">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="h-11 appearance-none pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === 'All' ? 'All Roles' : r}
                  </option>
                ))}
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Logistics Dropdown */}
            <div className="relative">
              <select
                value={selectedLogistics}
                onChange={(e) => setSelectedLogistics(e.target.value as any)}
                className="h-11 appearance-none pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
              >
                <option value="All">All Logistics</option>
                <option value="specialNeeds">Any Special Need</option>
                <option value="dietary">Dietary Restrictions</option>
                <option value="accessibility">Accessibility Needs</option>
                <option value="travel">Travel / Hotel</option>
              </select>
              <Utensils className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-11 appearance-none pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
              >
                <option value="name-asc">Sort: Name (A–Z)</option>
                <option value="name-desc">Sort: Name (Z–A)</option>
                <option value="org-asc">Sort: Organization</option>
                <option value="status">Sort: Checked In First</option>
                <option value="newest">Sort: Newly Registered</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Active Filter Chips & Counter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-slate-800">
              Showing {filteredAndSortedAttendees.length} of {attendees.length} participants
            </span>

            {hasActiveFilters && (
              <>
                <span className="text-slate-300">|</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    Search: &ldquo;{searchTerm}&rdquo;
                    <button type="button" onClick={() => setSearchTerm('')} className="hover:text-slate-900 cursor-pointer">
                      ×
                    </button>
                  </span>
                )}
                {selectedStatus !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                    Status: {selectedStatus === 'checkedIn' ? 'Checked In' : 'Pending'}
                    <button type="button" onClick={() => setSelectedStatus('All')} className="hover:text-emerald-950 cursor-pointer">
                      ×
                    </button>
                  </span>
                )}
                {selectedRole !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                    Role: {selectedRole}
                    <button type="button" onClick={() => setSelectedRole('All')} className="hover:text-blue-950 cursor-pointer">
                      ×
                    </button>
                  </span>
                )}
                {selectedDay !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200">
                    Day: {CONVENING_DAYS.find((d) => d.id === selectedDay)?.short}
                    <button type="button" onClick={() => setSelectedDay('All')} className="hover:text-indigo-950 cursor-pointer">
                      ×
                    </button>
                  </span>
                )}
                {selectedLogistics !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 font-semibold border border-rose-200">
                    Logistics: {selectedLogistics}
                    <button type="button" onClick={() => setSelectedLogistics('All')} className="hover:text-rose-950 cursor-pointer">
                      ×
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-blue-600 hover:text-blue-800 font-bold ml-1 cursor-pointer underline text-[11px]"
                >
                  Clear all filters
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={-1}>All</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Main Content: Table or Cards View */}
      {viewMode === 'table' ? (
        <div className="overflow-hidden rounded-3xl bg-white border border-slate-200/90 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 sticky top-0 z-10 backdrop-blur-sm">
                  <th className="py-4 px-5">Participant & Pass</th>
                  <th className="py-4 px-4">Capacity / Role</th>
                  <th className="py-4 px-4">Contact</th>
                  <th className="py-4 px-4">Logistics & Care</th>
                  <th className="py-4 px-4">Attendance Status</th>
                  <th className="py-4 px-5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAttendees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="text-base font-bold text-slate-900">No participants match your filters</p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Try searching with different terms or reset your active filters to see all registered attendees.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1C2C4F] text-white hover:bg-[#162844] text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reset All Filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAttendees.map((attendee) => {
                    const days = checkInDays[attendee.id] || [];
                    const isCheckedInForTarget = days.includes(targetDay);
                    const hasDay1 = days.includes('2026-11-09');
                    const hasDay2 = days.includes('2026-11-10');
                    const hasDay3 = days.includes('2026-11-11');

                    const history = checkInHistory[attendee.id] || [];
                    const targetScan = history.find((h) => h.eventDay === targetDay);

                    const roleBadge = ROLE_BADGES[attendee.role] || {
                      bg: 'bg-slate-100',
                      text: 'text-slate-700',
                      border: 'border-slate-200',
                      dot: 'bg-slate-400',
                    };

                    const initials = getInitials(attendee.firstName, attendee.lastName, attendee.name);
                    const isActionLoading = actionLoadingId === `${attendee.id}-${targetDay}`;

                    return (
                      <tr
                        key={attendee.id}
                        onClick={() => setDetailAttendee(attendee)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* 1. Attendee Avatar, Name, Org & Pass Code */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3.5">
                            {/* Avatar */}
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-xs text-white shadow-xs ${
                                attendee.role === 'Grantee'
                                  ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                                  : attendee.role === 'OAK Staff'
                                  ? 'bg-gradient-to-br from-[#111C33] to-[#1C2C4F]'
                                  : attendee.role === 'Coordination Team'
                                  ? 'bg-gradient-to-br from-purple-600 to-purple-800'
                                  : attendee.role === 'Presenter'
                                  ? 'bg-gradient-to-br from-amber-600 to-amber-700'
                                  : 'bg-gradient-to-br from-slate-600 to-slate-800'
                              }`}
                            >
                              {initials}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors text-sm">
                                  {attendee.name}
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 font-semibold truncate max-w-[220px]">
                                {attendee.organization}
                              </p>

                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {/* Click-to-copy pass code pill */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyEventCode(attendee.eventCode);
                                  }}
                                  title="Click to copy pass code"
                                  className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md border border-slate-200 transition cursor-pointer"
                                >
                                  {copiedEventCode === attendee.eventCode ? (
                                    <>
                                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                                      <span className="text-emerald-700">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-2.5 h-2.5 text-slate-400" />
                                      <span>{attendee.eventCode || 'NO-CODE'}</span>
                                    </>
                                  )}
                                </button>

                                {attendee.subPartner && (
                                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/80 truncate max-w-[150px]">
                                    {attendee.subPartner}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Capacity / Role */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${roleBadge.dot}`} />
                            {attendee.role}
                          </span>
                        </td>

                        {/* 3. Contact */}
                        <td className="py-4 px-4 text-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <a
                              href={`mailto:${attendee.email}`}
                              className="font-medium text-slate-800 hover:text-blue-600 flex items-center gap-1.5 group/mail"
                              title={attendee.email}
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400 group-hover/mail:text-blue-600 shrink-0" />
                              <span className="truncate max-w-[160px]">{attendee.email}</span>
                            </a>
                            {attendee.phone ? (
                              <a
                                href={`tel:${attendee.phone}`}
                                className="text-slate-500 hover:text-blue-600 text-[11px] font-mono flex items-center gap-1.5 group/phone"
                              >
                                <Phone className="w-3 h-3 text-slate-400 group-hover/phone:text-blue-600 shrink-0" />
                                <span>{attendee.phone}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">No phone listed</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Logistics & Special Care */}
                        <td className="py-4 px-4 text-xs max-w-[200px]">
                          <div className="space-y-1">
                            {attendee.dietary && (
                              <div
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-bold truncate max-w-full"
                                title={`Dietary requirement: ${attendee.dietary}`}
                              >
                                <Utensils className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate">{attendee.dietary}</span>
                              </div>
                            )}

                            {attendee.accessibility && (
                              <div
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold truncate max-w-full"
                                title={`Accessibility requirement: ${attendee.accessibility}`}
                              >
                                <Accessibility className="w-3 h-3 text-amber-600 shrink-0" />
                                <span className="truncate">{attendee.accessibility}</span>
                              </div>
                            )}

                            {(attendee.travelNeeds || attendee.accommodation) && (
                              <div
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-50 text-sky-900 border border-sky-200 text-[10px] font-bold truncate max-w-full"
                                title={`Travel & Hotel: ${attendee.accommodation || attendee.travelNeeds}`}
                              >
                                <Plane className="w-3 h-3 text-sky-600 shrink-0" />
                                <span className="truncate">{attendee.accommodation || attendee.travelNeeds}</span>
                              </div>
                            )}

                            {!attendee.dietary &&
                              !attendee.accessibility &&
                              !attendee.travelNeeds &&
                              !attendee.accommodation && (
                                <span className="text-slate-400 text-[11px] font-medium">Standard</span>
                              )}
                          </div>
                        </td>

                        {/* 5. Attendance Status & Multi-Day Breakdown */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="space-y-1.5">
                            {/* Target Day Status */}
                            {isCheckedInForTarget ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-800 border border-emerald-200 shadow-2xs">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>Checked In</span>
                                {targetScan && (
                                  <span className="font-semibold text-emerald-700 text-[10px]">
                                    ({formatHarareTime(targetScan.scannedAt)})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 border border-slate-200">
                                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>Pending</span>
                              </span>
                            )}

                            {/* D1, D2, D3 Multi-day tracker */}
                            <div className="flex items-center gap-1">
                              <span
                                title={hasDay1 ? 'Checked in on Day 1 (9 Nov)' : 'Pending on Day 1'}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-tight ${
                                  hasDay1
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}
                              >
                                D1
                              </span>
                              <span
                                title={hasDay2 ? 'Checked in on Day 2 (10 Nov)' : 'Pending on Day 2'}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-tight ${
                                  hasDay2
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}
                              >
                                D2
                              </span>
                              <span
                                title={hasDay3 ? 'Checked in on Day 3 (11 Nov)' : 'Pending on Day 3'}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-tight ${
                                  hasDay3
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}
                              >
                                D3
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 6. Quick Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1-Click Check-In / Undo Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleCheckIn(attendee)}
                              disabled={isActionLoading}
                              title={
                                isCheckedInForTarget
                                  ? `Undo check-in for ${CONVENING_DAYS.find((d) => d.id === targetDay)?.short}`
                                  : `Check in ${attendee.name} for ${CONVENING_DAYS.find((d) => d.id === targetDay)?.short}`
                              }
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition shadow-2xs cursor-pointer ${
                                isCheckedInForTarget
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-[#1C2C4F] hover:bg-[#162844] text-white'
                              }`}
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isCheckedInForTarget ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Attended</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Check In</span>
                                </>
                              )}
                            </button>

                            {/* Digital Pass link */}
                            <Link
                              href={`/pass/${attendee.id}`}
                              target="_blank"
                              title="Open digital attendee pass"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                              <span className="hidden sm:inline">Pass</span>
                            </Link>

                            {/* View Profile Drawer */}
                            <button
                              type="button"
                              onClick={() => setDetailAttendee(attendee)}
                              title="View full attendee profile"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                              <span className="hidden sm:inline">Details</span>
                            </button>

                            {/* Super Admin Delete */}
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => setDeletingAttendee(attendee)}
                                title={`Permanently delete ${attendee.name}`}
                                className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-700 transition cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60 text-xs">
              <div className="text-slate-600 font-semibold">
                Showing{' '}
                <strong className="text-slate-900">
                  {Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedAttendees.length)}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-900">
                  {Math.min(currentPage * pageSize, filteredAndSortedAttendees.length)}
                </strong>{' '}
                of <strong className="text-slate-900">{filteredAndSortedAttendees.length}</strong> participants
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl font-bold transition cursor-pointer text-xs ${
                          currentPage === pageNum
                            ? 'bg-[#1C2C4F] text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && <span className="text-slate-400 px-1">...</span>}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Card Grid View (Responsive & Mobile/Tablet-optimized) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedAttendees.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200/90 shadow-sm">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-base font-bold text-slate-800">No participants found</p>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your search or active filters.</p>
              </div>
            ) : (
              paginatedAttendees.map((attendee) => {
                const days = checkInDays[attendee.id] || [];
                const isCheckedInForTarget = days.includes(targetDay);
                const hasDay1 = days.includes('2026-11-09');
                const hasDay2 = days.includes('2026-11-10');
                const hasDay3 = days.includes('2026-11-11');
                const initials = getInitials(attendee.firstName, attendee.lastName, attendee.name);
                const roleBadge = ROLE_BADGES[attendee.role] || {
                  bg: 'bg-slate-100',
                  text: 'text-slate-700',
                  border: 'border-slate-200',
                  dot: 'bg-slate-400',
                };
                const isActionLoading = actionLoadingId === `${attendee.id}-${targetDay}`;

                return (
                  <div
                    key={attendee.id}
                    onClick={() => setDetailAttendee(attendee)}
                    className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header: Avatar, Name, Code */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-xs text-white shadow-xs ${
                              attendee.role === 'Grantee'
                                ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                                : attendee.role === 'OAK Staff'
                                ? 'bg-gradient-to-br from-[#111C33] to-[#1C2C4F]'
                                : attendee.role === 'Coordination Team'
                                ? 'bg-gradient-to-br from-purple-600 to-purple-800'
                                : attendee.role === 'Presenter'
                                ? 'bg-gradient-to-br from-amber-600 to-amber-700'
                                : 'bg-gradient-to-br from-slate-600 to-slate-800'
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-slate-900 text-sm leading-snug truncate">
                              {attendee.name}
                            </h3>
                            <p className="text-xs text-slate-600 font-semibold truncate mt-0.5">
                              {attendee.organization}
                            </p>
                          </div>
                        </div>

                        {/* Copy Code Pill */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyEventCode(attendee.eventCode);
                          }}
                          className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shrink-0 hover:bg-slate-200 transition cursor-pointer"
                        >
                          {copiedEventCode === attendee.eventCode ? 'Copied' : attendee.eventCode || 'NO-CODE'}
                        </button>
                      </div>

                      {/* Role & Sub-partner */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${roleBadge.dot}`} />
                          {attendee.role}
                        </span>
                        {attendee.subPartner && (
                          <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 truncate max-w-[150px]">
                            {attendee.subPartner}
                          </span>
                        )}
                      </div>

                      {/* Contact & Needs Summary */}
                      <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{attendee.email}</span>
                        </div>
                        {attendee.phone && (
                          <div className="flex items-center gap-2 text-[11px] font-mono">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{attendee.phone}</span>
                          </div>
                        )}
                        {attendee.dietary && (
                          <div className="flex items-center gap-2 text-emerald-900 font-semibold text-[11px]">
                            <Utensils className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{attendee.dietary}</span>
                          </div>
                        )}
                        {attendee.accessibility && (
                          <div className="flex items-center gap-2 text-amber-900 font-semibold text-[11px]">
                            <Accessibility className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{attendee.accessibility}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Status & Actions */}
                    <div
                      className="pt-3 mt-4 border-t border-slate-100 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Multi-day indicators & status */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                              hasDay1
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            D1
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                              hasDay2
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            D2
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                              hasDay3
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            D3
                          </span>
                        </div>

                        <div>
                          {isCheckedInForTarget ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Full-width 1-Click Check-In Action Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleCheckIn(attendee)}
                        disabled={isActionLoading}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer ${
                          isCheckedInForTarget
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-[#1C2C4F] hover:bg-[#162844] text-white'
                        }`}
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isCheckedInForTarget ? (
                          <>
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                            <span>Checked In (Undo)</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Check In Now</span>
                          </>
                        )}
                      </button>

                      {/* Secondary row links */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <Link
                          href={`/pass/${attendee.id}`}
                          target="_blank"
                          className="font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Digital Pass</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailAttendee(attendee)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                          >
                            Details
                          </button>

                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeletingAttendee(attendee)}
                              className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-700 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Card Grid Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-slate-600 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Attendee Details Slide-Over Drawer */}
      {detailAttendee && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setDetailAttendee(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 z-10 border-l border-slate-200">
            {/* Header */}
            <div>
              <div className="p-6 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-black text-lg text-white shadow-md ${
                      detailAttendee.role === 'Grantee'
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                        : detailAttendee.role === 'OAK Staff'
                        ? 'bg-gradient-to-br from-[#111C33] to-[#1C2C4F]'
                        : detailAttendee.role === 'Coordination Team'
                        ? 'bg-gradient-to-br from-purple-600 to-purple-800'
                        : 'bg-gradient-to-br from-slate-600 to-slate-800'
                    }`}
                  >
                    {getInitials(detailAttendee.firstName, detailAttendee.lastName, detailAttendee.name)}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight">{detailAttendee.name}</h2>
                    <p className="text-xs font-bold text-slate-600 mt-0.5">{detailAttendee.organization}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                        {detailAttendee.role}
                      </span>
                      {detailAttendee.subPartner && (
                        <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          {detailAttendee.subPartner}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailAttendee(null)}
                  className="p-2 rounded-xl hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  aria-label="Close profile drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scannable Pass Identification & QR Code Card */}
              <div className="p-6 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row items-center gap-5">
                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0 flex flex-col items-center">
                  <QRCodeSVG
                    value={detailAttendee.eventCode || detailAttendee.id}
                    size={110}
                    level="M"
                    includeMargin={false}
                  />
                  <span className="font-mono text-[9px] font-extrabold text-slate-500 mt-1.5">
                    {detailAttendee.eventCode || 'NO-CODE'}
                  </span>
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div>
                    <span className="text-slate-400 font-extrabold block text-[10px] uppercase tracking-wider">
                      Event Pass Code
                    </span>
                    <span className="font-mono font-black text-slate-900 text-base">
                      {detailAttendee.eventCode || 'NO-CODE'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Scannable credentials for on-site verification, nametag printing, and convening session attendance.
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopyEventCode(detailAttendee.eventCode)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
                    >
                      {copiedEventCode === detailAttendee.eventCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/admin/nametags?code=${encodeURIComponent(detailAttendee.eventCode)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Print Nametag</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Drawer Content Sections */}
              <div className="p-6 space-y-6">
                {/* 1. Daily Check-In Attendance Tracker */}
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    <span>Daily Attendance Records</span>
                  </h3>

                  <div className="space-y-2.5">
                    {CONVENING_DAYS.filter((d) => d.id !== 'All').map((d) => {
                      const days = checkInDays[detailAttendee.id] || [];
                      const isChecked = days.includes(d.id);
                      const history = checkInHistory[detailAttendee.id] || [];
                      const scanRecord = history.find((h) => h.eventDay === d.id);
                      const isActionLoading = actionLoadingId === `${detailAttendee.id}-${d.id}`;

                      return (
                        <div
                          key={d.id}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition ${
                            isChecked
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isChecked ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            ) : (
                              <Clock className="w-5 h-5 text-slate-300 shrink-0" />
                            )}
                            <div>
                              <span className="font-extrabold text-slate-900">{d.label}</span>
                              {scanRecord ? (
                                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                                  Scanned at {formatHarareTime(scanRecord.scannedAt)}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Not yet scanned</p>
                              )}
                            </div>
                          </div>

                          {/* Quick Check-in Button in Drawer */}
                          <button
                            type="button"
                            onClick={() => handleToggleCheckIn(detailAttendee, d.id)}
                            disabled={isActionLoading}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                              isChecked
                                ? 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                                : 'bg-[#1C2C4F] text-white hover:bg-[#162844]'
                            }`}
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isChecked ? (
                              'Undo Check-In'
                            ) : (
                              'Mark Attended'
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Contact Details */}
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>Contact Information</span>
                  </h3>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Email</span>
                      <a
                        href={`mailto:${detailAttendee.email}`}
                        className="font-bold text-slate-900 hover:text-blue-600 hover:underline"
                      >
                        {detailAttendee.email}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Phone Number</span>
                      {detailAttendee.phone ? (
                        <a
                          href={`tel:${detailAttendee.phone}`}
                          className="font-mono font-bold text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {detailAttendee.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">None provided</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Logistics, Dietary & Accommodations */}
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-slate-400" />
                    <span>Logistics & Special Requirements</span>
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-800 font-extrabold mb-1.5">
                        <Utensils className="w-4 h-4 text-emerald-600" />
                        <span>Dietary Requirements</span>
                      </div>
                      <p className="text-slate-600 pl-6 leading-relaxed">
                        {detailAttendee.dietary || <span className="text-slate-400 italic">Standard (No restrictions reported)</span>}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-800 font-extrabold mb-1.5">
                        <Accessibility className="w-4 h-4 text-amber-600" />
                        <span>Accessibility Needs</span>
                      </div>
                      <p className="text-slate-600 pl-6 leading-relaxed">
                        {detailAttendee.accessibility || <span className="text-slate-400 italic">None reported</span>}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-800 font-extrabold mb-1.5">
                        <Plane className="w-4 h-4 text-blue-600" />
                        <span>Travel & Flight Arrangements</span>
                      </div>
                      <p className="text-slate-600 pl-6 leading-relaxed">
                        {detailAttendee.travelNeeds || <span className="text-slate-400 italic">None reported</span>}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2 text-slate-800 font-extrabold mb-1.5">
                        <Hotel className="w-4 h-4 text-purple-600" />
                        <span>Accommodation & Hotel Booking</span>
                      </div>
                      <p className="text-slate-600 pl-6 leading-relaxed">
                        {detailAttendee.accommodation || <span className="text-slate-400 italic">None reported</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Metadata Audit */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <div>
                    <span className="font-bold text-slate-700">Registered:</span>{' '}
                    {formatFullDate(detailAttendee.createdAt)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Consent Given:</span>{' '}
                    {formatFullDate(detailAttendee.consentGivenAt)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Attendee ID:</span>{' '}
                    <span className="font-mono text-[10px]">{detailAttendee.id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <Link
                href={`/pass/${detailAttendee.id}`}
                target="_blank"
                className="flex-1 py-3 px-4 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold text-center shadow-md transition"
              >
                Open Digital Pass
              </Link>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setDeletingAttendee(detailAttendee)}
                  className="py-3 px-4 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Super Admin Delete Confirmation Modal */}
      {deletingAttendee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isDeleting && setDeletingAttendee(null)}
          />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900">Permanently Delete Attendee</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to permanently delete registered attendee{' '}
              <strong className="text-slate-900">{deletingAttendee.name}</strong> ({deletingAttendee.email})?
            </p>

            <div className="my-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div>
                <span className="text-slate-500 font-semibold">Pass Code:</span>{' '}
                <span className="font-mono font-bold text-slate-900">{deletingAttendee.eventCode}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Organization:</span>{' '}
                <span className="font-bold text-slate-900">{deletingAttendee.organization}</span>
              </div>
            </div>

            <p className="text-[11px] text-red-700 bg-red-50 p-3 rounded-2xl border border-red-200 mb-6 font-semibold leading-relaxed">
              This will permanently revoke their pass, delete check-in scans, and record this action in the audit trail.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingAttendee(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
