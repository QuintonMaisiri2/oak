"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  Activity,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  UserPlus,
  KeyRound,
  Filter,
  Eye,
  X,
  Clock,
  Terminal,
  FolderOpen,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Copy,
  Check,
  FileText,
  Lock,
} from "lucide-react";
import { AuditLogEntry } from "@/lib/audit";

interface ActivityClientViewProps {
  initialLogs: AuditLogEntry[];
  currentSuperAdminEmail: string;
}

export function ActivityClientView({
  initialLogs,
  currentSuperAdminEmail,
}: ActivityClientViewProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [search, setSearch] = useState("");
  const [actionCategory, setActionCategory] = useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inspectLog, setInspectLog] = useState<AuditLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/activity");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to refresh audit logs", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute metrics
  const stats = useMemo(() => {
    let logins = 0;
    let denials = 0;
    let adminChanges = 0;
    let driveActions = 0;

    logs.forEach((log) => {
      if (log.action === "login_success") logins++;
      if (log.action === "login_denied") denials++;
      if (log.action.startsWith("admin_")) adminChanges++;
      if (log.action.startsWith("drive_")) driveActions++;
    });

    return {
      total: logs.length,
      logins,
      denials,
      adminChanges,
      driveActions,
    };
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const textToSearch = `${log.action} ${log.actor_email || ""} ${log.target_email || ""} ${
        log.ip_address || ""
      } ${JSON.stringify(log.details || {})}`.toLowerCase();
      const matchesSearch = textToSearch.includes(search.toLowerCase().trim());

      let matchesCategory = true;
      if (actionCategory === "LOGINS") {
        matchesCategory = log.action.startsWith("login_");
      } else if (actionCategory === "ADMINS") {
        matchesCategory = log.action.startsWith("admin_");
      } else if (actionCategory === "DRIVE") {
        matchesCategory = log.action.startsWith("drive_");
      } else if (actionCategory === "DENIED") {
        matchesCategory = log.action === "login_denied";
      }

      return matchesSearch && matchesCategory;
    });
  }, [logs, search, actionCategory]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, actionCategory]);

  // Pagination calculation
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = useMemo(() => {
    if (pageSize === -1) return filteredLogs;
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "login_success":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Login Success</span>
          </span>
        );
      case "login_denied":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Login Denied</span>
          </span>
        );
      case "admin_role_changed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-purple-800 border border-purple-200">
            <KeyRound className="w-3.5 h-3.5 text-purple-600" />
            <span>Role Modified</span>
          </span>
        );
      case "admin_added":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
            <UserPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>Admin Authorized</span>
          </span>
        );
      case "admin_deactivated":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
            <UserX className="w-3.5 h-3.5 text-amber-600" />
            <span>Deactivated</span>
          </span>
        );
      case "admin_reactivated":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reactivated</span>
          </span>
        );
      case "admin_removed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-800 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>Admin Removed</span>
          </span>
        );
      case "drive_file_approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>File Approved</span>
          </span>
        );
      case "drive_file_rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
            <XCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>File Rejected</span>
          </span>
        );
      case "drive_file_restored":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span>File Restored</span>
          </span>
        );
      case "drive_file_deleted":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>File Deleted</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
            {action.replace(/_/g, " ")}
          </span>
        );
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const now = Date.now();
      const past = new Date(isoString).getTime();
      const diffSec = Math.floor((now - past) / 1000);

      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return "-";
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#111C33] via-[#16284D] to-[#1C2C4F] text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                <ShieldAlert className="w-3.5 h-3.5 fill-slate-950" />
                <span>Super Admin Audit</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-300">
                Immutable Governance & Security Trail
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Activity & Security Audit</span>
              <span className="text-sm sm:text-base font-bold px-3 py-1 rounded-full bg-white/15 text-white border border-white/20">
                {logs.length} Events
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Real-time audit record of authentication attempts, role modifications, file approvals, and administrative actions with IP addresses and full event payloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            <button
              onClick={fetchLogs}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#111C33] hover:bg-slate-100 font-extrabold text-xs shadow-md transition transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh Feed</span>
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* 2. Interactive KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => setActionCategory("ALL")}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            actionCategory === "ALL"
              ? "border-[#1C2C4F] ring-2 ring-[#1C2C4F]/15 bg-slate-50/50"
              : "border-slate-200/90 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Events</span>
            <Activity className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{stats.total}</div>
          <div className="text-[11px] font-medium text-slate-500 mt-1">Recorded audit events</div>
        </button>

        <button
          type="button"
          onClick={() => setActionCategory(actionCategory === "LOGINS" ? "ALL" : "LOGINS")}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            actionCategory === "LOGINS"
              ? "border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/30"
              : "border-slate-200/90 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Logins</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">{stats.logins}</div>
          <div className="text-[11px] font-medium text-emerald-600/90 mt-1">Successful staff logins</div>
        </button>

        <button
          type="button"
          onClick={() => setActionCategory(actionCategory === "DENIED" ? "ALL" : "DENIED")}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            actionCategory === "DENIED"
              ? "border-red-500 ring-2 ring-red-500/15 bg-red-50/30"
              : "border-slate-200/90 hover:border-red-300"
          }`}
        >
          <div className="flex items-center justify-between text-red-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Access Denied</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-700 tracking-tight">{stats.denials}</div>
          <div className="text-[11px] font-medium text-red-600/90 mt-1">Security flags & blocks</div>
        </button>

        <button
          type="button"
          onClick={() => setActionCategory(actionCategory === "ADMINS" ? "ALL" : "ADMINS")}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            actionCategory === "ADMINS"
              ? "border-purple-500 ring-2 ring-purple-500/15 bg-purple-50/30"
              : "border-slate-200/90 hover:border-purple-300"
          }`}
        >
          <div className="flex items-center justify-between text-purple-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Admin Roles</span>
            <KeyRound className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">{stats.adminChanges}</div>
          <div className="text-[11px] font-medium text-purple-600/90 mt-1">Role & status updates</div>
        </button>

        <button
          type="button"
          onClick={() => setActionCategory(actionCategory === "DRIVE" ? "ALL" : "DRIVE")}
          className={`col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            actionCategory === "DRIVE"
              ? "border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/30"
              : "border-slate-200/90 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between text-blue-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Drive & Files</span>
            <HardDrive className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700 tracking-tight">{stats.driveActions}</div>
          <div className="text-[11px] font-medium text-blue-600/90 mt-1">Approvals & moderation</div>
        </button>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by actor, target email, action, IP, or payload details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-2xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] focus:bg-white transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setActionCategory("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  actionCategory === "ALL"
                    ? "bg-[#1C2C4F] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setActionCategory("LOGINS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  actionCategory === "LOGINS"
                    ? "bg-[#1C2C4F] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Logins ({stats.logins})
              </button>
              <button
                type="button"
                onClick={() => setActionCategory("ADMINS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  actionCategory === "ADMINS"
                    ? "bg-[#1C2C4F] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Team ({stats.adminChanges})
              </button>
              <button
                type="button"
                onClick={() => setActionCategory("DRIVE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  actionCategory === "DRIVE"
                    ? "bg-[#1C2C4F] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Drive ({stats.driveActions})
              </button>
              <button
                type="button"
                onClick={() => setActionCategory("DENIED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  actionCategory === "DENIED"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-red-700 hover:text-red-900"
                }`}
              >
                Denied ({stats.denials})
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-medium">
          <span>
            Showing <strong className="text-slate-800">{filteredLogs.length}</strong> of{" "}
            <strong className="text-slate-800">{logs.length}</strong> audited events
          </span>
          {(search || actionCategory !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setActionCategory("ALL");
              }}
              className="text-blue-600 hover:underline font-bold"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Audit Log Table */}
      <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="py-4 px-5">Timestamp</th>
                <th className="py-4 px-4">Event Action</th>
                <th className="py-4 px-4">Actor</th>
                <th className="py-4 px-4">Target / Entity</th>
                <th className="py-4 px-4">IP Address</th>
                <th className="py-4 px-5 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Activity className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-base font-bold text-slate-800">No audit events match your search</p>
                      <p className="text-xs text-slate-500">
                        Try clearing active filters to view all recorded system events.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const relative = formatRelativeTime(log.created_at);
                  const fullDate = formatDate(log.created_at);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setInspectLog(log)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div>
                          <span className="font-extrabold text-slate-900 text-xs block">
                            {relative}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {fullDate}
                          </span>
                        </div>
                      </td>

                      {/* Event Action */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Actor */}
                      <td className="py-4 px-4">
                        <div className="min-w-0 max-w-[200px]">
                          <span className="font-extrabold text-slate-900 text-xs block truncate" title={log.actor_email || "System"}>
                            {log.actor_email || "System"}
                          </span>
                          {log.actor_email === currentSuperAdminEmail && (
                            <span className="text-[10px] font-bold text-amber-700">You (Super Admin)</span>
                          )}
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-4 px-4">
                        <span className="text-xs text-slate-600 font-mono truncate max-w-[180px] block" title={log.target_email || "-"}>
                          {log.target_email || "-"}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Terminal className="w-3 h-3 text-slate-400" />
                          <span>{log.ip_address || "internal"}</span>
                        </span>
                      </td>

                      {/* Inspect Action */}
                      <td className="py-4 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setInspectLog(log)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60 text-xs">
            <div className="text-slate-600 font-semibold">
              Showing{" "}
              <strong className="text-slate-900">
                {Math.min((currentPage - 1) * pageSize + 1, filteredLogs.length)}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-900">
                {Math.min(currentPage * pageSize, filteredLogs.length)}
              </strong>{" "}
              of <strong className="text-slate-900">{filteredLogs.length}</strong> events
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

              <span className="text-xs font-bold text-slate-600 px-2">
                Page {currentPage} of {totalPages}
              </span>

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

      {/* 5. In-Depth Event Inspect Drawer */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setInspectLog(null)}
          />

          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250 z-10 border-l border-slate-200">
            <div>
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getActionBadge(inspectLog.action)}
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      ID: {inspectLog.id?.slice(0, 8)}...
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900">
                    Event Details & Payload
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {formatDate(inspectLog.created_at)}
                  </p>
                </div>

                <button
                  onClick={() => setInspectLog(null)}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Event Attributes */}
              <div className="p-6 space-y-5 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-0.5">
                      Action Type
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {inspectLog.action}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-0.5">
                      Actor
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {inspectLog.actor_email || "System Generated"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-0.5">
                      Target Entity
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {inspectLog.target_email || "None"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-0.5">
                      Client IP Address
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-white text-slate-800 border border-slate-200">
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>{inspectLog.ip_address || "internal-dispatch"}</span>
                    </span>
                  </div>
                </div>

                {/* Formatted JSON Payload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Payload Metadata (JSON)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(inspectLog.details || {}, null, 2))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
                    >
                      {copiedId ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                    {JSON.stringify(inspectLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-5 py-2.5 rounded-xl bg-[#1C2C4F] text-white text-xs font-bold hover:bg-[#162844] transition shadow-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
