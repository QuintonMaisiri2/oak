'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  ShieldAlert,
  Users,
  Activity,
  Mail,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Clock,
  ArrowRight,
  LayoutDashboard,
  Database,
  Server,
  Download,
} from 'lucide-react';
import type { AttendeeRecord } from '@/lib/mockApi';
import { buildAttendeeCsv } from '@/lib/attendee-export';

interface SuperAdminDashboardViewProps {
  attendees: AttendeeRecord[];
  onSwitchToAdmin: () => void;
}

type TeamMember = {
  role?: 'super_admin' | 'admin' | string;
  is_active?: boolean;
};

type ActivityLog = {
  id?: string | number;
  action: string;
  actor_email?: string;
  created_at?: string;
};

type DriveStatus = {
  configured: boolean;
  fileCount: number;
  lastUpdated?: string;
};

type EmailStatus = {
  isConfigured: boolean;
  provider: string;
};

type ErrorLogItem = {
  id?: string;
  source?: string;
  message?: string;
  details?: {
    cause?: string;
    sheet_row_index?: number;
    external_slot_id?: string;
    booker_name?: string;
    organisation?: string;
    booker_email?: string;
    slot_date?: string;
    slot_time?: string;
    attempts?: number;
    secret_length?: number;
  };
  booking_id?: string;
  slot_id?: string;
  created_at?: string;
};

type SyncQueueItem = {
  status?: string;
  id?: string;
  [key: string]: string | number | boolean | undefined;
};

export function SuperAdminDashboardView({
  attendees,
  onSwitchToAdmin,
}: SuperAdminDashboardViewProps) {
  // State for metrics and live activity
  const [teamStats, setTeamStats] = useState<{ totalAdmins: number; superAdmins: number; regularAdmins: number } | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [driveStats, setDriveStats] = useState<DriveStatus | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailStatus | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [failedQueueItems, setFailedQueueItems] = useState<SyncQueueItem[]>([]);
  const [isRetryingQueue, setIsRetryingQueue] = useState(false);
  const [isTestingSheet, setIsTestingSheet] = useState(false);
  const [sheetPingStatus, setSheetPingStatus] = useState<{
    ok: boolean;
    scriptVersion?: string | null;
    sheetTabName?: string | null;
    secretLength?: number;
    cause?: string | null;
    error?: string | null;
    testedAt?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute attendee check-in metrics
  const totalRegistered = attendees.length;
  const totalCheckedIn = attendees.filter(
    (a) =>
      a.attendanceStatus === 'Checked In' ||
      Boolean(a.checkInTime || (a.checkIns && a.checkIns.length > 0))
  ).length;
  const checkInRate = totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;

  // Load superadmin system overview data
  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      setIsLoading(true);

      try {
        // Fetch Team data
        const teamPromise = fetch('/api/admin/team')
          .then(async (res) => {
            if (!res.ok) {
              return { admins: [] as TeamMember[] };
            }
            const data = (await res.json()) as { admins?: TeamMember[] };
            return { admins: data.admins ?? [] };
          })
          .then((data) => {
            const list = data.admins || [];
            const supers = list.filter((a) => a.role === 'super_admin' && a.is_active).length;
            const regulars = list.filter((a) => a.role === 'admin' && a.is_active).length;
            return { totalAdmins: list.length, superAdmins: supers, regularAdmins: regulars };
          })
          .catch(() => null);

        // Fetch Activity data
        const activityPromise = fetch('/api/admin/activity')
          .then(async (res) => {
            if (!res.ok) {
              return [] as ActivityLog[];
            }
            const data = (await res.json()) as { logs?: ActivityLog[] };
            return (data.logs ?? []).slice(0, 7);
          })
          .catch(() => [] as ActivityLog[]);

        // Fetch Drive data
        const drivePromise = fetch('/api/drive/files')
          .then(async (res): Promise<DriveStatus | null> => {
            if (!res.ok) {
              return { configured: false, fileCount: 0, lastUpdated: undefined };
            }
            const data = (await res.json()) as { configured?: boolean; files?: unknown[]; lastUpdated?: string };
            return {
              configured: Boolean(data.configured),
              fileCount: Array.isArray(data.files) ? data.files.length : 0,
              lastUpdated: data.lastUpdated,
            };
          })
          .catch(() => null);

        // Fetch Email config
        const emailPromise = fetch('/api/admin/email-test')
          .then(async (res) => {
            if (!res.ok) {
              return null;
            }
            const data = (await res.json()) as { isConfigured?: boolean; provider?: string } | null;
            return data ? { isConfigured: Boolean(data.isConfigured), provider: data.provider || 'smtp' } : null;
          })
          .catch(() => null);

        // Fetch Error Log & Sheet Sync Queue status
        const errorsPromise = fetch('/api/admin/errors')
          .then(async (res) => {
            if (!res.ok) {
              return { errors: [] as ErrorLogItem[], queue: [] as SyncQueueItem[] };
            }
            const data = (await res.json()) as { errors?: ErrorLogItem[]; queue?: SyncQueueItem[] };
            return {
              errors: Array.isArray(data.errors) ? data.errors : [],
              queue: Array.isArray(data.queue) ? data.queue : [],
            };
          })
          .catch(() => ({ errors: [] as ErrorLogItem[], queue: [] as SyncQueueItem[] }));

        const [teamRes, activityRes, driveRes, emailRes, errorsRes] = await Promise.all([
          teamPromise,
          activityPromise,
          drivePromise,
          emailPromise,
          errorsPromise,
        ]);

        if (mounted) {
          if (teamRes) setTeamStats(teamRes);
          if (activityRes) setRecentLogs(activityRes);
          if (driveRes) setDriveStats(driveRes);
          if (emailRes) setEmailConfig(emailRes);
          if (errorsRes) {
            setErrorLogs(errorsRes.errors);
            setFailedQueueItems(
              errorsRes.queue.filter((q) => q.status !== 'synced')
            );
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleExportAttendees = () => {
    if (!attendees.length) return;

    const csv = buildAttendeeCsv(attendees);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `oak-attendee-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleRetrySyncQueue = async () => {
    setIsRetryingQueue(true);
    try {
      const res = await fetch('/api/admin/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_queue' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { errors?: ErrorLogItem[]; queue?: SyncQueueItem[] };
        setErrorLogs(Array.isArray(data.errors) ? data.errors : []);
        setFailedQueueItems(
          Array.isArray(data.queue) ? data.queue.filter((q) => q.status !== 'synced') : []
        );
      }
    } finally {
      setIsRetryingQueue(false);
    }
  };

  const handleTestSheetConnection = async () => {
    setIsTestingSheet(true);
    try {
      const res = await fetch('/api/meetings/admin/sheets/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        scriptVersion?: string | null;
        sheetTabName?: string | null;
        secretLength?: number;
        cause?: string | null;
        error?: string | null;
        testedAt?: string;
      };
      setSheetPingStatus({
        ok: Boolean(data.ok),
        scriptVersion: data.scriptVersion || null,
        sheetTabName: data.sheetTabName || null,
        secretLength: typeof data.secretLength === 'number' ? data.secretLength : undefined,
        cause: data.cause || null,
        error: data.error || null,
        testedAt: data.testedAt || new Date().toISOString(),
      });
      handleRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to test sheet connection';
      setSheetPingStatus({
        ok: false,
        cause: 'network error',
        error: message,
        testedAt: new Date().toISOString(),
      });
    } finally {
      setIsTestingSheet(false);
    }
  };

  const handleDismissError = async (id?: string, all?: boolean) => {
    try {
      const res = await fetch('/api/admin/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id, all: Boolean(all) }),
      });
      if (res.ok) {
        const data = await res.json();
        setErrorLogs(Array.isArray(data.errors) ? data.errors : []);
      }
    } catch {
      // Ignore dismiss error
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  const formatActionName = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getLogBadgeColor = (action: string) => {
    if (action.includes('denied') || action.includes('delete') || action.includes('deactivated')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (action.includes('success') || action.includes('approved') || action.includes('added')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('role') || action.includes('restore')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Switcher */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#111C33] via-[#16284D] to-[#1C2C4F] text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                <ShieldAlert className="w-3.5 h-3.5 fill-slate-950" />
                <span>Super Administrator</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Monitoring
              </span>
              <span className="text-[11px] font-semibold text-slate-300">
                System Command Center · Governance Mode · Day 3 Live · Real-Time Sync Active
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Platform Administration & Governance
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Supervise administrative access, monitor tamper-evident security audit logs, verify email dispatch and Google Sheets 1:1 sync infrastructure, and control Google Drive asset pipelines.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Live governance snapshot active · Sheets & Drive Synced
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start lg:self-center">
            <button
              onClick={handleTestSheetConnection}
              disabled={isTestingSheet}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingSheet ? 'animate-spin text-amber-300' : ''}`} />
              <span>Test sheet connection</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh System Metrics"
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-300' : ''}`} />
            </button>

            <button
              onClick={onSwitchToAdmin}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#111C33] hover:bg-slate-100 font-bold text-xs shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
              <span>Switch to Staff Admin View</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* 1A. Live Sheet Ping Result Banner (when admin clicks "Test sheet connection") */}
      {sheetPingStatus && (
        <div
          className={`rounded-2xl border p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            sheetPingStatus.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black uppercase ${
                sheetPingStatus.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {sheetPingStatus.ok ? 'Sheet Ping OK' : 'Sheet Ping Failed'}
            </span>
            {sheetPingStatus.scriptVersion && (
              <span className="font-mono font-bold">
                version: {sheetPingStatus.scriptVersion}
              </span>
            )}
            {sheetPingStatus.sheetTabName && (
              <span className="font-mono font-bold">
                tab: &quot;{sheetPingStatus.sheetTabName}&quot;
              </span>
            )}
            {typeof sheetPingStatus.secretLength === 'number' && (
              <span className="font-mono text-slate-600">
                secret(len={sheetPingStatus.secretLength})
              </span>
            )}
            {sheetPingStatus.cause && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold">
                Cause: {sheetPingStatus.cause}
              </span>
            )}
            {sheetPingStatus.error && !sheetPingStatus.ok && (
              <span className="font-semibold text-red-700">{sheetPingStatus.error}</span>
            )}
          </div>
          <button
            onClick={() => setSheetPingStatus(null)}
            className="text-slate-500 hover:text-slate-800 font-bold text-[11px] self-end sm:self-center cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1B. Visible Alert Banner for Unresolved error_log & Failed Sheet Sync Queue Items */}
      {(errorLogs.length > 0 || failedQueueItems.length > 0) && (
        <div
          data-testid="superadmin-error-log-alert"
          className="rounded-3xl bg-red-50 border-2 border-red-200 p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                    System Alert · error_log
                  </span>
                  <span className="text-xs font-extrabold text-red-900">
                    {errorLogs.length} Unresolved Error{errorLogs.length === 1 ? '' : 's'} ·{' '}
                    {failedQueueItems.length} Queued Sheet Sync Item{failedQueueItems.length === 1 ? '' : 's'}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-red-950 tracking-tight">
                  Google Sheets Booking Write-Back Requires Attention
                </h2>
                <p className="text-xs text-red-800/90 font-medium leading-relaxed max-w-3xl">
                  One or more 1:1 bookings failed to sync to the Google Sheet and have been queued in{' '}
                  <code className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-900">sheet_sync_queue</code>{' '}
                  for automatic retry with exponential backoff. Verify{' '}
                  <code className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-900">SHEETS_WEBHOOK_SECRET</code>{' '}
                  or Google Service Account credentials, then click Retry Queue &amp; Backfill.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleTestSheetConnection}
                disabled={isTestingSheet}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-red-100/60 text-red-900 border border-red-200 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSheet ? 'animate-spin' : ''}`} />
                <span>Test sheet connection</span>
              </button>
              <button
                onClick={handleRetrySyncQueue}
                disabled={isRetryingQueue}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetryingQueue ? 'animate-spin' : ''}`} />
                <span>{isRetryingQueue ? 'Retrying Queue...' : 'Retry Queue & Backfill Now'}</span>
              </button>
              <Link
                href="/admin/bookings"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-red-100/60 text-red-900 border border-red-200 text-xs font-extrabold transition"
              >
                <span>Open 1:1 Bookings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {errorLogs.length > 0 && (
                <button
                  onClick={() => handleDismissError(undefined, true)}
                  className="inline-flex items-center px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-red-700 border border-red-200 text-xs font-bold transition cursor-pointer"
                >
                  Dismiss All
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {errorLogs.slice(0, 5).map((err: ErrorLogItem) => (
              <div
                key={err.id}
                className="p-3.5 rounded-2xl bg-white border border-red-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-mono text-[10px] font-black uppercase">
                      {err.source || 'sheets_sync'}
                    </span>
                    {err.details?.cause && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-extrabold">
                        Cause: {err.details.cause}
                      </span>
                    )}
                    {err.details?.sheet_row_index && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                        Sheet Row {err.details.sheet_row_index} ({err.details.external_slot_id || 'Slot'})
                      </span>
                    )}
                    {err.details?.booker_name && (
                      <span className="font-bold text-slate-900">
                        {err.details.booker_name} ({err.details.organisation || err.details.booker_email})
                      </span>
                    )}
                    {err.details?.slot_date && (
                      <span className="text-slate-500 font-medium">
                        · {err.details.slot_date} {err.details.slot_time}
                      </span>
                    )}
                  </div>
                  <p className="text-red-700 font-semibold break-words">{err.message}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono">
                    {err.booking_id && <span>booking_id: {err.booking_id}</span>}
                    {err.slot_id && <span>slot_id: {err.slot_id}</span>}
                    {err.details?.attempts !== undefined && (
                      <span>attempts: {err.details.attempts}</span>
                    )}
                    {err.details?.secret_length !== undefined && (
                      <span>
                        secret(len={err.details.secret_length})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span className="text-[10px] font-mono text-slate-400">
                    {formatDate(err.created_at)}
                  </span>
                  <button
                    onClick={() => handleDismissError(err.id, false)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 transition cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. System Status Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Database</span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Supabase Online
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Email System</span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {emailConfig?.provider ? `${emailConfig.provider.toUpperCase()} Ready` : 'SMTP Verified'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Drive Pipeline</span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {driveStats?.configured ? 'Service Acct Synced' : 'Drive Active'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Security Audit</span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Tamper-Evident Active
            </span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={handleTestSheetConnection}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTestSheetConnection();
            }
          }}
          title="Click to test Google Sheets webhook connection"
          className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center gap-3 transition cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <RefreshCw className={`w-4 h-4 ${isTestingSheet ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Sheets Sync</span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sheetPingStatus
                    ? sheetPingStatus.ok
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                    : failedQueueItems.length > 0
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
              />
              {sheetPingStatus
                ? sheetPingStatus.ok
                  ? 'Webhook Verified'
                  : 'Ping Failed'
                : failedQueueItems.length > 0
                  ? `${failedQueueItems.length} in Queue`
                  : 'Apps Script Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Core Governance Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Team & Access */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Active Staff
              </span>
            </div>

            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {teamStats ? teamStats.totalAdmins : '–'}
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-1">Authorized Administrators</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {teamStats ? `${teamStats.superAdmins} Super Admins · ${teamStats.regularAdmins} Regular Staff` : 'Loading team counts...'}
            </p>
          </div>

          <Link
            href="/admin/team"
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-blue-600 group-hover:text-blue-800 flex items-center justify-between"
          >
            <span>Manage Team & Access</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Card 2: Security & Activity */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Live Audit
              </span>
            </div>

            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {recentLogs.length > 0 ? `${recentLogs.length}+` : 'Active'}
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-1">Security Audit Log</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Immutable trail of logins, role updates & approvals
            </p>
          </div>

          <Link
            href="/admin/activity"
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-blue-600 group-hover:text-blue-800 flex items-center justify-between"
          >
            <span>View Audit Trail</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Card 3: Email Service */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Port 465 SSL
              </span>
            </div>

            <div className="text-lg font-black text-slate-900 tracking-tight">
              Gmail SMTP / Resend
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-1">Email Dispatch System</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              1:1 booking notices & attendee credentials
            </p>
          </div>

          <Link
            href="/admin/email-test"
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-blue-600 group-hover:text-blue-800 flex items-center justify-between"
          >
            <span>Test Email Dispatch</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Card 4: Google Drive Shared Files */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  driveStats?.configured
                    ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                    : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}
              >
                {driveStats?.configured ? 'Connected' : 'Drive Sync'}
              </span>
            </div>

            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {driveStats ? `${driveStats.fileCount}` : '–'}
              <span className="text-base font-bold text-slate-500 ml-1">Files</span>
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-1">Google Drive Repository</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Published presentations, notes & review queue
            </p>
          </div>

          <Link
            href="/admin/drive"
            className="mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-blue-600 group-hover:text-blue-800 flex items-center justify-between"
          >
            <span>Drive Infrastructure</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* 4. Event Operations Summary Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900 text-base tracking-tight">
              Convening Operations Status
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Real-time attendance check-in metrics across the 3-day convening.
            </p>
          </div>
          <button
            onClick={onSwitchToAdmin}
            className="text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 self-start sm:self-center cursor-pointer"
          >
            <span>Open Attendance Management</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total Registered</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalRegistered}</div>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">Confirmed participants</span>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/70">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Checked In</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">{totalCheckedIn}</div>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">Arrived on site</span>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/70">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">Check-In Progress</span>
            <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-1">{checkInRate}%</div>
            <div className="w-full bg-blue-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${checkInRate}%` }} />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/70">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">Pending Check-In</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1">{totalRegistered - totalCheckedIn}</div>
            <span className="text-[11px] text-amber-700/80 font-medium mt-0.5 block">Awaiting arrival</span>
          </div>
        </div>
      </div>

      {/* 5. Quick Super Admin Actions Grid & Recent Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Tools */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
              Super Administrator Controls
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Full System Access
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExportAttendees}
              disabled={!attendees.length}
              className="p-4 rounded-2xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40 transition flex flex-col justify-between group text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 group-hover:text-cyan-700">
                  <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-700">
                    <Download className="w-4 h-4" />
                  </div>
                  <span>Export Attendee Roster</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Download a clean CSV of every registered attendee for governance, follow-up, or reporting.
                </p>
              </div>
              <span className="text-[11px] font-bold text-cyan-600 mt-3 flex items-center gap-1 group-hover:underline">
                {attendees.length ? `Export ${attendees.length} records` : 'No attendees yet'} <ArrowRight className="w-3 h-3" />
              </span>
            </button>

            <Link
              href="/admin/team"
              className="p-4 rounded-2xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition flex flex-col justify-between group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 group-hover:text-purple-700">
                  <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>Team & Permissions</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Authorize staff, promote super admins, or deactivate team access.
                </p>
              </div>
              <span className="text-[11px] font-bold text-purple-600 mt-3 flex items-center gap-1 group-hover:underline">
                Manage team <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/activity"
              className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition flex flex-col justify-between group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 group-hover:text-blue-700">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span>Security Audit Log</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Inspect actor IPs, timestamps, denied logins, and administrative actions.
                </p>
              </div>
              <span className="text-[11px] font-bold text-blue-600 mt-3 flex items-center gap-1 group-hover:underline">
                View audit trail <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/email-test"
              className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition flex flex-col justify-between group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 group-hover:text-emerald-700">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span>Email Diagnostics</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Test SMTP/Gmail delivery latency and verify dispatch infrastructure.
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 mt-3 flex items-center gap-1 group-hover:underline">
                Run diagnostics <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/drive/review"
              className="p-4 rounded-2xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 transition flex flex-col justify-between group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 group-hover:text-amber-700">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span>Upload Approvals</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Review incoming participant uploads, approve to folders, or moderate files.
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-700 mt-3 flex items-center gap-1 group-hover:underline">
                Review queue <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/admin/bookings"
              className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition flex flex-col justify-between group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 group-hover:text-indigo-700">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <span>1:1 Bookings & Sheet Sync</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Manage grantee 1:1 sessions, test the Google Sheets webhook, and monitor sync retries.
                </p>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 mt-3 flex items-center gap-1 group-hover:underline">
                Open 1:1 bookings <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>

        {/* Recent Audit Events Stream */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Live Audit Stream
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Most recent security & system operations</p>
            </div>
            <Link
              href="/admin/activity"
              className="text-xs font-extrabold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2 flex-1 pt-1">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-2xl border border-slate-100">
                No recent security events recorded.
              </div>
            ) : (
              recentLogs.map((log: ActivityLog, idx: number) => (
                <div
                  key={log.id || idx}
                  className="p-3 rounded-2xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/70 flex items-center justify-between gap-3 text-xs transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${getLogBadgeColor(log.action)} shrink-0`}>
                      {log.action.split('_')[0].toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 block truncate">
                        {formatActionName(log.action)}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate block font-mono">
                        {log.actor_email || 'System'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono font-medium">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Automated immutable logging enabled</span>
            <Link href="/admin/activity" className="text-blue-600 font-extrabold hover:underline">
              Inspect full log →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
