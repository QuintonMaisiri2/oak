"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  UserPlus,
  Users,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Search,
  Mail,
  Building2,
  Lock,
  X,
  Power,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ArrowUpDown,
  UserCheck,
  UserX,
  KeyRound,
  LayoutGrid,
  LayoutList,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { AdminUserRecord } from "@/lib/auth/admin-users";

interface EnrichedAdmin extends AdminUserRecord {
  is_shared_mailbox?: boolean;
}

interface TeamClientViewProps {
  initialAdmins: EnrichedAdmin[];
  currentSuperAdminEmail: string;
  allowedDomains: string[];
}

export function TeamClientView({
  initialAdmins,
  currentSuperAdminEmail,
  allowedDomains,
}: TeamClientViewProps) {
  const [admins, setAdmins] = useState<EnrichedAdmin[]>(initialAdmins);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmRoleAdmin, setConfirmRoleAdmin] = useState<EnrichedAdmin | null>(null);
  const [confirmStatusAdmin, setConfirmStatusAdmin] = useState<EnrichedAdmin | null>(null);
  const [confirmDeleteAdmin, setConfirmDeleteAdmin] = useState<EnrichedAdmin | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    team: "Coordination Team",
    role: "admin" as "admin" | "super_admin",
  });

  const normalizedCurrentEmail = currentSuperAdminEmail.toLowerCase().trim();

  // Filtered admins
  const filteredAdmins = admins.filter((admin) => {
    const matchesSearch =
      admin.full_name.toLowerCase().includes(search.toLowerCase()) ||
      admin.email.toLowerCase().includes(search.toLowerCase());

    const matchesTeam =
      teamFilter === "ALL" ||
      (teamFilter === "COORDINATION" && admin.team === "Coordination Team") ||
      (teamFilter === "OAK" && admin.team === "OAK");

    const matchesRole =
      roleFilter === "ALL" ||
      (roleFilter === "SUPER" && admin.role === "super_admin") ||
      (roleFilter === "REGULAR" && admin.role === "admin");

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && admin.is_active) ||
      (statusFilter === "INACTIVE" && !admin.is_active);

    return matchesSearch && matchesTeam && matchesRole && matchesStatus;
  });

  // Stats
  const totalCount = admins.length;
  const coordinationCount = admins.filter((a) => a.team === "Coordination Team").length;
  const oakCount = admins.filter((a) => a.team === "OAK").length;
  const activeSuperCount = admins.filter((a) => a.role === "super_admin" && a.is_active).length;
  const activeCount = admins.filter((a) => a.is_active).length;

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Add Admin Handler
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailTrimmed = formData.email.trim().toLowerCase();
    const domain = emailTrimmed.split("@")[1];

    if (!allowedDomains.includes(domain)) {
      setErrorMessage(
        `Email domain "@${domain || ""}" is not permitted. Only accounts on @${allowedDomains.join(
          ", @"
        )} can be authorized.`
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: emailTrimmed,
          team: formData.team,
          role: formData.role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add administrator");
      }

      setAdmins((prev) => [
        {
          ...data.admin,
          is_shared_mailbox: emailTrimmed.startsWith("comms@") || emailTrimmed.startsWith("info@"),
        },
        ...prev,
      ]);

      setSuccessMessage(
        `✓ ${data.admin.full_name} (${data.admin.email}) was authorized as a ${
          data.admin.role === "super_admin" ? "Super Admin" : "Staff Admin"
        }.`
      );
      setIsAddModalOpen(false);
      setFormData({
        full_name: "",
        email: "",
        team: "Coordination Team",
        role: "admin",
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add administrator");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status Handler
  const handleExecuteToggleActive = async () => {
    if (!confirmStatusAdmin) return;
    const admin = confirmStatusAdmin;

    if (admin.email === normalizedCurrentEmail) {
      setErrorMessage("Security restriction: You cannot deactivate your own active super administrator account.");
      setConfirmStatusAdmin(null);
      return;
    }

    setIsActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextState = !admin.is_active;

    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: admin.email, is_active: nextState }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update administrator status");
      }

      setAdmins((prev) =>
        prev.map((a) => (a.email === admin.email ? { ...a, is_active: nextState } : a))
      );
      setSuccessMessage(
        `${admin.full_name} has been ${nextState ? "reactivated" : "deactivated"} successfully.`
      );
      setConfirmStatusAdmin(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update status");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Toggle Admin / Super Admin Role Handler
  const handleExecuteToggleRole = async () => {
    if (!confirmRoleAdmin) return;
    const admin = confirmRoleAdmin;

    if (admin.email === normalizedCurrentEmail) {
      setErrorMessage("Security restriction: You cannot demote your own active super administrator account.");
      setConfirmRoleAdmin(null);
      return;
    }

    setIsActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextRole = admin.role === "super_admin" ? "admin" : "super_admin";

    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: admin.email, role: nextRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update administrator role");
      }

      setAdmins((prev) =>
        prev.map((a) => (a.email === admin.email ? { ...a, role: nextRole } : a))
      );
      setSuccessMessage(
        `${admin.full_name} has been updated to ${nextRole === "super_admin" ? "Super Administrator" : "Staff Administrator"}.`
      );
      setConfirmRoleAdmin(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update role");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Remove Admin Handler
  const handleExecuteRemoveAdmin = async () => {
    if (!confirmDeleteAdmin) return;
    const admin = confirmDeleteAdmin;

    if (admin.email === normalizedCurrentEmail) {
      setErrorMessage("You cannot delete your own active super administrator account.");
      setConfirmDeleteAdmin(null);
      return;
    }

    setIsActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/admin/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: admin.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove administrator");
      }

      setAdmins((prev) => prev.filter((a) => a.email !== admin.email));
      setSuccessMessage(`${admin.full_name} has been removed from the platform admin team.`);
      setConfirmDeleteAdmin(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to remove administrator");
    } finally {
      setIsActionLoading(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name.slice(0, 2) || "AD").toUpperCase();
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
                <span>Super Admin Governance</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-300">
                Staff Authentication & RBAC Policy
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Team & Permissions Control
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Manage authorized administrative accounts, assign governance privileges, and enforce domain verification for Oak Foundation and Coordination personnel.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-slate-400 font-medium">Authorized Domains:</span>
              {allowedDomains.map((domain) => (
                <span
                  key={domain}
                  className="px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold bg-white/10 text-white border border-white/15"
                >
                  @{domain}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            <button
              onClick={() => {
                setErrorMessage(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#111C33] hover:bg-slate-100 font-extrabold text-xs shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>Authorize Administrator</span>
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-semibold text-red-900 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-950 font-bold ml-2 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Shared Mailbox Caution Banner */}
      <div className="rounded-3xl bg-amber-50/90 border border-amber-200/90 p-5 flex items-start gap-3.5 shadow-2xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 space-y-1">
          <p className="font-extrabold text-amber-900 text-sm">Account Audit & Accountability Notice</p>
          <p className="text-amber-800/90 leading-relaxed font-medium">
            Accounts flagged with <strong className="font-bold text-amber-950">Shared Mailbox</strong> (such as <code className="bg-amber-100/90 px-1.5 py-0.5 rounded font-mono text-[11px] text-amber-950">comms@uncommon.org</code>) cannot be attributed to a single individual. All administrative operations appear under the shared email in immutable audit logs. Where possible, authorize individual personal staff credentials.
          </p>
        </div>
      </div>

      {/* 2. Interactive KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setTeamFilter("ALL");
            setRoleFilter("ALL");
            setStatusFilter("ALL");
          }}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            teamFilter === "ALL" && roleFilter === "ALL" && statusFilter === "ALL"
              ? "border-[#1C2C4F] ring-2 ring-[#1C2C4F]/15 bg-slate-50/50"
              : "border-slate-200/90 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Admins</span>
            <Users className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{totalCount}</div>
          <div className="text-[11px] font-medium text-slate-500 mt-1">Allowlisted personnel</div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter(roleFilter === "SUPER" ? "ALL" : "SUPER")}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            roleFilter === "SUPER"
              ? "border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/30"
              : "border-slate-200/90 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Super Admins</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight">{activeSuperCount}</div>
          <div className="text-[11px] font-medium text-amber-700/80 mt-1">Governance authority</div>
        </button>

        <button
          type="button"
          onClick={() => setTeamFilter(teamFilter === "COORDINATION" ? "ALL" : "COORDINATION")}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            teamFilter === "COORDINATION"
              ? "border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/30"
              : "border-slate-200/90 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between text-blue-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Coordination</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-800 tracking-tight">{coordinationCount}</div>
          <div className="text-[11px] font-medium text-blue-600/90 mt-1">Uncommon staff</div>
        </button>

        <button
          type="button"
          onClick={() => setTeamFilter(teamFilter === "OAK" ? "ALL" : "OAK")}
          className={`p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            teamFilter === "OAK"
              ? "border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/30"
              : "border-slate-200/90 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">OAK Team</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight">{oakCount}</div>
          <div className="text-[11px] font-medium text-emerald-600/90 mt-1">OAK Foundation</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "ACTIVE" ? "ALL" : "ACTIVE")}
          className={`col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border text-left transition shadow-xs cursor-pointer group ${
            statusFilter === "ACTIVE"
              ? "border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/30"
              : "border-slate-200/90 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Staff</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">{activeCount}</div>
          <div className="text-[11px] font-medium text-emerald-600/90 mt-1">Authorized access</div>
        </button>
      </div>

      {/* 3. Filter Toolbar & Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by full name or email address..."
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
            {/* Team Filter */}
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
            >
              <option value="ALL">All Teams ({totalCount})</option>
              <option value="COORDINATION">Coordination ({coordinationCount})</option>
              <option value="OAK">OAK Team ({oakCount})</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER">Super Admin ({activeSuperCount})</option>
              <option value="REGULAR">Staff Admin ({totalCount - activeSuperCount})</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active ({activeCount})</option>
              <option value="INACTIVE">Deactivated ({totalCount - activeCount})</option>
            </select>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition ${
                  viewMode === "table" ? "bg-white text-[#1C2C4F] shadow-xs" : "text-slate-400 hover:text-slate-700"
                }`}
                title="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-2 rounded-lg transition ${
                  viewMode === "cards" ? "bg-white text-[#1C2C4F] shadow-xs" : "text-slate-400 hover:text-slate-700"
                }`}
                title="Card grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-medium">
          <span>
            Showing <strong className="text-slate-800">{filteredAdmins.length}</strong> of{" "}
            <strong className="text-slate-800">{admins.length}</strong> team accounts
          </span>
          {(search || teamFilter !== "ALL" || roleFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setTeamFilter("ALL");
                setRoleFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="text-blue-600 hover:underline font-bold"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Content: Table or Cards */}
      {viewMode === "table" ? (
        <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="py-4 px-5">Administrator</th>
                  <th className="py-4 px-4">Affiliation / Team</th>
                  <th className="py-4 px-4">Governance Role</th>
                  <th className="py-4 px-4">Account Status</th>
                  <th className="py-4 px-5 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Users className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-base font-bold text-slate-800">No administrators match your filters</p>
                        <p className="text-xs text-slate-500">
                          Try searching for a different name or clearing active team filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => {
                    const isCurrent = admin.email === normalizedCurrentEmail;
                    const isSuper = admin.role === "super_admin";
                    const initials = getInitials(admin.full_name);

                    return (
                      <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Administrator */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-xs text-white shadow-xs ${
                                isSuper
                                  ? "bg-gradient-to-br from-amber-500 to-amber-700"
                                  : "bg-gradient-to-br from-[#111C33] to-[#1C2C4F]"
                              }`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-sm">
                                  {admin.full_name}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-slate-500 font-mono truncate">
                                  {admin.email}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyEmail(admin.email)}
                                  className="text-slate-400 hover:text-slate-700"
                                  title="Copy email"
                                >
                                  {copiedEmail === admin.email ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              {admin.is_shared_mailbox && (
                                <span className="inline-block mt-1 text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  Shared Mailbox
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Team */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              admin.team === "OAK"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}
                          >
                            <Building2 className="w-3 h-3" />
                            {admin.team === "OAK" ? "OAK Foundation" : "Coordination Team"}
                          </span>
                        </td>

                        {/* Role */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-900 border border-amber-300">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                              <span>Super Admin</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <Shield className="w-3.5 h-3.5 text-slate-500" />
                              <span>Staff Admin</span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {admin.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              Deactivated
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {/* Toggle Super Admin / Regular Admin */}
                            <button
                              type="button"
                              onClick={() => setConfirmRoleAdmin(admin)}
                              disabled={isCurrent}
                              title={
                                isCurrent
                                  ? "You cannot demote your own account"
                                  : isSuper
                                  ? "Demote to Regular Staff Admin"
                                  : "Promote to Super Administrator"
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                isSuper
                                  ? "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              {isSuper ? "Demote" : "Promote to Super"}
                            </button>

                            {/* Toggle Active Status */}
                            <button
                              type="button"
                              onClick={() => setConfirmStatusAdmin(admin)}
                              disabled={isCurrent}
                              title={
                                isCurrent
                                  ? "You cannot deactivate your own account"
                                  : admin.is_active
                                  ? "Deactivate administrator"
                                  : "Reactivate administrator"
                              }
                              className={`p-2 rounded-xl border text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs ${
                                admin.is_active
                                  ? "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-800"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Admin */}
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAdmin(admin)}
                              disabled={isCurrent}
                              title={isCurrent ? "You cannot remove your own account" : "Remove administrator"}
                              className="p-2 rounded-xl border border-slate-200 bg-white hover:border-red-400 hover:bg-red-50 text-slate-400 hover:text-red-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAdmins.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-base font-bold text-slate-800">No administrators match your filters</p>
            </div>
          ) : (
            filteredAdmins.map((admin) => {
              const isCurrent = admin.email === normalizedCurrentEmail;
              const isSuper = admin.role === "super_admin";
              const initials = getInitials(admin.full_name);

              return (
                <div
                  key={admin.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-xs text-white shadow-xs ${
                            isSuper
                              ? "bg-gradient-to-br from-amber-500 to-amber-700"
                              : "bg-gradient-to-br from-[#111C33] to-[#1C2C4F]"
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-900 text-sm leading-tight truncate">
                            {admin.full_name}
                          </h3>
                          <span className="text-xs text-slate-500 font-mono block truncate mt-0.5">
                            {admin.email}
                          </span>
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                          You
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          admin.team === "OAK"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}
                      >
                        {admin.team === "OAK" ? "OAK Foundation" : "Coordination"}
                      </span>

                      {isSuper ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-900 border border-amber-300">
                          Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Staff Admin
                        </span>
                      )}

                      {admin.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 ml-auto">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 ml-auto">
                          Inactive
                        </span>
                      )}
                    </div>

                    {admin.is_shared_mailbox && (
                      <p className="text-[10px] text-amber-800 bg-amber-50/80 p-2 rounded-xl border border-amber-200 font-medium leading-relaxed">
                        Shared mailbox account. Actions in audit log cannot be attributed to a single person.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRoleAdmin(admin)}
                      disabled={isCurrent}
                      className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-40"
                    >
                      {isSuper ? "Demote to Staff" : "Promote to Super"}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmStatusAdmin(admin)}
                        disabled={isCurrent}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        title="Toggle active"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAdmin(admin)}
                        disabled={isCurrent}
                        className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50 disabled:opacity-40"
                        title="Remove admin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. Add Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isSubmitting && setIsAddModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#111C33] text-white flex items-center justify-center shadow-xs">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Authorize Administrator</h3>
                  <p className="text-xs text-slate-500 font-medium">Grant staff administrative credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-start gap-2 mt-4">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Silvia Guizzardi"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F]"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                  Corporate Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@oakfnd.org, name@uncommon.org"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F]"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400">Allowed domains:</span>
                  {allowedDomains.map((d) => (
                    <span key={d} className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      @{d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    Affiliation / Team
                  </label>
                  <select
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F]"
                  >
                    <option value="Coordination Team">Coordination Team</option>
                    <option value="OAK">OAK Foundation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                    Authority Level
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as "admin" | "super_admin" })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F]"
                  >
                    <option value="admin">Staff Admin</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authorizing...</span>
                    </>
                  ) : (
                    <span>Authorize Admin</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. In-App Role Change Confirmation Modal */}
      {confirmRoleAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isActionLoading && setConfirmRoleAdmin(null)}
          />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900">
              {confirmRoleAdmin.role === "super_admin"
                ? "Demote to Staff Administrator"
                : "Promote to Super Administrator"}
            </h3>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {confirmRoleAdmin.role === "super_admin" ? (
                <>
                  Are you sure you want to demote <strong className="text-slate-900">{confirmRoleAdmin.full_name}</strong> ({confirmRoleAdmin.email}) to Regular Staff Admin? They will lose access to team management, security audit logs, and system governance.
                </>
              ) : (
                <>
                  Are you sure you want to promote <strong className="text-slate-900">{confirmRoleAdmin.full_name}</strong> ({confirmRoleAdmin.email}) to Super Administrator? They will receive full governance authority over team members, security logs, and infrastructure.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setConfirmRoleAdmin(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleExecuteToggleRole}
                className="px-5 py-2.5 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Confirm Role Change</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. In-App Deactivate/Reactivate Confirmation Modal */}
      {confirmStatusAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isActionLoading && setConfirmStatusAdmin(null)}
          />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in zoom-in-95 duration-150">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                confirmStatusAdmin.is_active ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              <Power className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900">
              {confirmStatusAdmin.is_active ? "Deactivate Administrator" : "Reactivate Administrator"}
            </h3>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {confirmStatusAdmin.is_active ? (
                <>
                  Are you sure you want to deactivate <strong className="text-slate-900">{confirmStatusAdmin.full_name}</strong> ({confirmStatusAdmin.email})? Their login access to the platform will be immediately revoked.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate <strong className="text-slate-900">{confirmStatusAdmin.full_name}</strong> ({confirmStatusAdmin.email})? They will immediately regain administrator access.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setConfirmStatusAdmin(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleExecuteToggleActive}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  confirmStatusAdmin.is_active
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : confirmStatusAdmin.is_active ? (
                  <span>Deactivate Account</span>
                ) : (
                  <span>Reactivate Account</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. In-App Delete Confirmation Modal */}
      {confirmDeleteAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isActionLoading && setConfirmDeleteAdmin(null)}
          />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900">Remove Administrator</h3>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to permanently remove <strong className="text-slate-900">{confirmDeleteAdmin.full_name}</strong> ({confirmDeleteAdmin.email}) from the platform admin team? This action is permanently recorded in the security audit trail.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setConfirmDeleteAdmin(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleExecuteRemoveAdmin}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Confirm Removal</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
