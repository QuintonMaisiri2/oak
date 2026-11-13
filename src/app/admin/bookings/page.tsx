"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessionStatus } from "@/lib/session";
import {
  Download,
  Trash2,
  ArrowLeft,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Search,
  Calendar,
  Users,
  Building,
  Mail,
  Send,
  Plus,
  Edit2,
  UserCheck,
  UserX,
  X,
  Clock
} from "lucide-react";

interface AdminBooking {
  id: string;
  name: string;
  email: string;
  organisation: string;
  message: string;
  status: string;
  email_status: string;
  email_error?: string | null;
  created_at: string;
  cancelled_at?: string | null;
  sheet_sync_status?: "pending" | "synced" | "failed";
  sheet_sync_error?: string | null;
  sheet_synced_at?: string | null;
  slots: {
    id: string;
    advisor_id?: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    note?: string | null;
    advisors?: {
      id: string;
      slug: string;
      full_name: string;
      job_title: string;
      email: string;
    } | Array<{
      id: string;
      slug: string;
      full_name: string;
      job_title: string;
      email: string;
    }>;
  } | Array<{
    id: string;
    advisor_id?: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    note?: string | null;
    advisors?: any;
  }>;
}

interface Advisor {
  id: string;
  slug: string;
  full_name: string;
  job_title: string;
  bio: string;
  photo_url?: string | null;
  email: string;
  is_active: boolean;
  total_slots?: number;
  available_slots?: number;
}

export default function AdminBookingsPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"bookings" | "advisors">("bookings");

  // Bookings State
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedAdvisorFilter, setSelectedAdvisorFilter] = useState<string>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<{
    ok: boolean;
    total: number;
    succeeded: number;
    failed: number;
    batches: number;
    error: string | null;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Advisors State
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loadingAdvisors, setLoadingAdvisors] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState<Advisor | null>(null);
  const [advFullName, setAdvFullName] = useState("");
  const [advJobTitle, setAdvJobTitle] = useState("");
  const [advBio, setAdvBio] = useState("");
  const [advEmail, setAdvEmail] = useState("");
  const [advPhotoUrl, setAdvPhotoUrl] = useState("");
  const [advIsActive, setAdvIsActive] = useState(true);
  const [savingAdvisor, setSavingAdvisor] = useState(false);
  const [advisorFormError, setAdvisorFormError] = useState<string | null>(null);

  // Add Slots Modal
  const [slotTargetAdvisor, setSlotTargetAdvisor] = useState<Advisor | null>(null);
  const [slotDate, setSlotDate] = useState("2026-11-10");
  const [slotStartTime, setSlotStartTime] = useState("10:00");
  const [slotEndTime, setSlotEndTime] = useState("10:30");
  const [slotDuration, setSlotDuration] = useState(30);
  const [slotNote, setSlotNote] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  // Notifications
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkAuthAndLoad = async () => {
      // 1. Check if user already has an active staff session
      try {
        const status = await getSessionStatus();
        if (!mounted) return;
        if (status.isStaff) {
          setIsAuthenticated(true);
          const saved = sessionStorage.getItem("oak_admin_booking_pw") || "";
          setPassword(saved);
          loadAllData(saved);
          return;
        }
      } catch {
        // Fall through to password check
      }

      // 2. Check saved password in sessionStorage
      const saved = sessionStorage.getItem("oak_admin_booking_pw");
      if (saved) {
        setPassword(saved);
        loadAllData(saved);
      } else {
        // 3. Try loading with empty password to check if session or dev mode allows it
        loadBookings("").then((success) => {
          if (success) {
            loadAdvisors("");
          }
        });
      }
    };

    checkAuthAndLoad();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadAllData(pw: string) {
    await Promise.all([loadBookings(pw), loadAdvisors(pw)]);
  }

  async function loadBookings(pw: string): Promise<boolean> {
    try {
      setLoadingBookings(true);
      const url = pw
        ? `/api/meetings/admin/bookings?password=${encodeURIComponent(pw)}`
        : `/api/meetings/admin/bookings`;
      const res = await fetch(url, {
        headers: pw ? { "x-admin-password": pw } : undefined,
      });
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          sessionStorage.removeItem("oak_admin_booking_pw");
          setAuthError("Incorrect admin password or staff session required.");
          return false;
        }
        throw new Error("Failed to load bookings");
      }
      const data = await res.json();
      setBookings(data.bookings || []);
      setIsAuthenticated(true);
      if (pw) sessionStorage.setItem("oak_admin_booking_pw", pw);
      setAuthError(null);
      return true;
    } catch (err: any) {
      console.error(err);
      return false;
    } finally {
      setLoadingBookings(false);
    }
  }

  async function loadAdvisors(pw: string) {
    try {
      setLoadingAdvisors(true);
      const url = pw
        ? `/api/advisors?all=true&password=${encodeURIComponent(pw)}`
        : `/api/advisors?all=true`;
      const res = await fetch(url, {
        headers: pw ? { "x-admin-password": pw } : undefined,
      });
      if (!res.ok) throw new Error("Failed to load advisors");
      const data = await res.json();
      setAdvisors(data.advisors || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAdvisors(false);
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    loadAllData(password.trim());
  };

  const handleCancelBooking = async (id: string, attendeeName: string) => {
    if (!confirm(`Are you sure you want to cancel the booking for "${attendeeName}"? This will free the slot immediately.`)) {
      return;
    }

    try {
      setCancellingId(id);
      const url = password
        ? `/api/meetings/admin/bookings/${id}?password=${encodeURIComponent(password)}`
        : `/api/meetings/admin/bookings/${id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: password ? { "x-admin-password": password } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to cancel booking");

      setActionMessage(`Cancelled booking for ${attendeeName}. Slot has been freed.`);
      setTimeout(() => setActionMessage(null), 5000);
      loadBookings(password);
      loadAdvisors(password);
    } catch (err: any) {
      alert(err.message || "Error cancelling booking");
    } finally {
      setCancellingId(null);
    }
  };

  const handleResendEmail = async (id: string, attendeeName: string) => {
    try {
      setResendingId(id);
      const url = password
        ? `/api/meetings/admin/bookings/${id}/resend-email?password=${encodeURIComponent(password)}`
        : `/api/meetings/admin/bookings/${id}/resend-email`;
      const res = await fetch(url, {
        method: "POST",
        headers: password ? { "x-admin-password": password } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to resend email");

      setActionMessage(`Email dispatch status: ${data.email_status} for ${attendeeName}`);
      setTimeout(() => setActionMessage(null), 5000);
      loadBookings(password);
    } catch (err: any) {
      alert(err.message || "Error resending email");
    } finally {
      setResendingId(null);
    }
  };

  const handleResyncBooking = async (id: string, attendeeName: string) => {
    try {
      setResyncingId(id);
      const url = password
        ? `/api/meetings/admin/bookings/${id}/resync?password=${encodeURIComponent(password)}`
        : `/api/meetings/admin/bookings/${id}/resync`;
      const res = await fetch(url, {
        method: "POST",
        headers: password ? { "x-admin-password": password } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to resync booking");

      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                sheet_sync_status: data.sheet_sync_status,
                sheet_sync_error: data.sheet_sync_error,
                sheet_synced_at: data.sheet_synced_at,
              }
            : b
        )
      );

      if (data.ok) {
        setActionMessage(`Synced booking for ${attendeeName} to Google Sheet.`);
      } else {
        setActionMessage(`Sheet sync failed for ${attendeeName}: ${data.sheet_sync_error || "Unknown error"}`);
      }
      setTimeout(() => setActionMessage(null), 6000);
      loadBookings(password);
    } catch (err: any) {
      alert(err.message || "Error resyncing booking");
    } finally {
      setResyncingId(null);
    }
  };

  const handleSyncAllBookings = async () => {
    try {
      setSyncingAll(true);
      setSyncAllResult(null);
      const url = password
        ? `/api/meetings/admin/bookings/sync-all?password=${encodeURIComponent(password)}`
        : `/api/meetings/admin/bookings/sync-all`;
      const res = await fetch(url, {
        method: "POST",
        headers: password ? { "x-admin-password": password } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to sync all bookings");

      setSyncAllResult({
        ok: Boolean(data.ok),
        total: data.total ?? 0,
        succeeded: data.succeeded ?? 0,
        failed: data.failed ?? 0,
        batches: data.batches ?? 0,
        error: data.error ?? null,
      });

      setActionMessage(
        `Sheet bulk sync finished: ${data.succeeded ?? 0} succeeded, ${data.failed ?? 0} failed (out of ${data.total ?? 0} bookings).`
      );
      setTimeout(() => setActionMessage(null), 7000);
      loadBookings(password);
    } catch (err: any) {
      alert(err.message || "Error syncing all bookings");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleExportCsv = () => {
    let url = password
      ? `/api/meetings/admin/bookings?password=${encodeURIComponent(password)}&format=csv`
      : `/api/meetings/admin/bookings?format=csv`;
    if (selectedAdvisorFilter !== "ALL") {
      url += `&advisor_id=${encodeURIComponent(selectedAdvisorFilter)}`;
    }
    window.location.href = url;
  };

  // Open Advisor Modal (New or Edit)
  const handleOpenAdvisorModal = (advisor?: Advisor) => {
    if (advisor) {
      setEditingAdvisor(advisor);
      setAdvFullName(advisor.full_name);
      setAdvJobTitle(advisor.job_title);
      setAdvBio(advisor.bio);
      setAdvEmail(advisor.email);
      setAdvPhotoUrl(advisor.photo_url || "");
      setAdvIsActive(advisor.is_active);
    } else {
      setEditingAdvisor(null);
      setAdvFullName("");
      setAdvJobTitle("");
      setAdvBio("");
      setAdvEmail("");
      setAdvPhotoUrl("");
      setAdvIsActive(true);
    }
    setAdvisorFormError(null);
    setShowAdvisorModal(true);
  };

  const handleSaveAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advFullName.trim() || !advJobTitle.trim() || !advBio.trim() || !advEmail.trim()) {
      setAdvisorFormError("Please fill in all required fields.");
      return;
    }

    try {
      setSavingAdvisor(true);
      setAdvisorFormError(null);

      const payload = {
        full_name: advFullName.trim(),
        job_title: advJobTitle.trim(),
        bio: advBio.trim(),
        email: advEmail.trim(),
        photo_url: advPhotoUrl.trim() || null,
        is_active: advIsActive,
      };

      const url = editingAdvisor
        ? (password ? `/api/advisors/${editingAdvisor.id}?password=${encodeURIComponent(password)}` : `/api/advisors/${editingAdvisor.id}`)
        : (password ? `/api/advisors?password=${encodeURIComponent(password)}` : `/api/advisors`);

      const method = editingAdvisor ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(password ? { "x-admin-password": password } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save advisor");

      setActionMessage(editingAdvisor ? `Updated advisor ${advFullName}` : `Created advisor ${advFullName}`);
      setTimeout(() => setActionMessage(null), 5000);
      setShowAdvisorModal(false);
      loadAdvisors(password);
    } catch (err: any) {
      setAdvisorFormError(err.message || "Error saving advisor");
    } finally {
      setSavingAdvisor(false);
    }
  };

  const handleToggleAdvisorActive = async (advisor: Advisor) => {
    try {
      const url = password
        ? `/api/advisors/${advisor.id}?password=${encodeURIComponent(password)}`
        : `/api/advisors/${advisor.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(password ? { "x-admin-password": password } : {}),
        },
        body: JSON.stringify({ is_active: !advisor.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      loadAdvisors(password);
    } catch (err: any) {
      alert(err.message || "Failed to toggle status");
    }
  };

  // Add Slots
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotTargetAdvisor) return;

    try {
      setSavingSlot(true);
      setSlotError(null);

      const startTime = `${slotDate}T${slotStartTime}:00+02:00`;
      const endTime = `${slotDate}T${slotEndTime}:00+02:00`;

      const url = password
        ? `/api/advisors/${slotTargetAdvisor.id}/slots?password=${encodeURIComponent(password)}`
        : `/api/advisors/${slotTargetAdvisor.id}/slots`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(password ? { "x-admin-password": password } : {}),
        },
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          duration_minutes: slotDuration,
          note: slotNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add slot");

      setActionMessage(`Added slot for ${slotTargetAdvisor.full_name}`);
      setTimeout(() => setActionMessage(null), 5000);
      setSlotTargetAdvisor(null);
      setSlotNote("");
      loadAdvisors(password);
      loadBookings(password);
    } catch (err: any) {
      setSlotError(err.message || "Failed to save slot");
    } finally {
      setSavingSlot(false);
    }
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const slot = Array.isArray(b.slots) ? b.slots[0] : b.slots;
    const advisor = slot?.advisors ? (Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors) : null;

    if (selectedAdvisorFilter !== "ALL" && slot?.advisor_id !== selectedAdvisorFilter) {
      return false;
    }

    const term = searchTerm.toLowerCase();
    return (
      b.name.toLowerCase().includes(term) ||
      b.email.toLowerCase().includes(term) ||
      b.organisation.toLowerCase().includes(term) ||
      (advisor?.full_name && advisor.full_name.toLowerCase().includes(term)) ||
      (slot?.note && slot.note.toLowerCase().includes(term))
    );
  }).sort((a, b) => {
    // Meeting order: Monday first, then Tuesday, Wednesday; earliest time first within a day.
    const startOf = (x: AdminBooking) => {
      const s = Array.isArray(x.slots) ? x.slots[0] : x.slots;
      const t = s?.start_time ? Date.parse(s.start_time) : NaN;
      return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    };
    return startOf(a) - startOf(b);
  });

  // Password Unlock Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-center text-slate-900">Admin Authentication</h1>
          <p className="text-xs text-center text-slate-500 mt-1 mb-6">
            Enter the ADMIN_PASSWORD to manage OAK advisor clinics and bookings.
          </p>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-pw" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <input
                id="admin-pw"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loadingBookings}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loadingBookings ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Unlock Admin Portal</span>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/book" className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 font-medium">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Clinic Bookings</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Link href="/admin" className="hover:text-slate-800 flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Admin Dashboard</span>
              </Link>
              <span>•</span>
              <span className="text-blue-600">OAK Clinics</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">1:1 Advisor Clinics Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage advisor profiles, create session slots, track booking status, and view calendar invitations.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/email-test"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition shadow-2xs cursor-pointer"
            >
              <Mail className="h-3.5 w-3.5 text-blue-600" />
              <span>Email Diagnostics</span>
            </Link>

            <button
              onClick={() => loadAllData(password)}
              disabled={loadingBookings || loadingAdvisors}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${(loadingBookings || loadingAdvisors) ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              <span>Refresh</span>
            </button>

            {activeTab === "bookings" && (
              <>
                <button
                  onClick={handleSyncAllBookings}
                  disabled={syncingAll || bookings.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {syncingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>Sync all bookings to sheet</span>
                </button>

                <button
                  onClick={handleExportCsv}
                  disabled={bookings.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>
              </>
            )}

            {activeTab === "advisors" && (
              <button
                onClick={() => handleOpenAdvisorModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Advisor</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`pb-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "bookings"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Bookings ({bookings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("advisors")}
            className={`pb-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "advisors"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Advisors & Clinics ({advisors.length})</span>
          </button>
        </div>

        {/* TAB 1: BOOKINGS */}
        {activeTab === "bookings" && (
          <div className="space-y-6">
              {syncAllResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    syncAllResult.failed === 0
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <div>
                    <span className="font-bold">Bulk Sheet Sync Result:</span>{" "}
                    <span>
                      {syncAllResult.succeeded} succeeded, {syncAllResult.failed} failed (total {syncAllResult.total} across{" "}
                      {syncAllResult.batches} batch{syncAllResult.batches === 1 ? "" : "es"}).
                    </span>
                    {syncAllResult.error && (
                      <span className="block text-rose-700 mt-0.5 font-medium">Error: {syncAllResult.error}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setSyncAllResult(null)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1.5"
                  >
                    Dismiss
                  </button>
                </div>
              )}

            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Total Bookings</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{bookings.length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Active Bookings</span>
                <p className="text-2xl font-extrabold text-emerald-600 mt-2">
                  {bookings.filter((b) => b.status === "confirmed").length}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Organisations</span>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">
                  {new Set(bookings.map((b) => b.organisation)).size}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Advisors</span>
                <p className="text-2xl font-extrabold text-indigo-600 mt-2">{advisors.length}</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-auto">
                <select
                  value={selectedAdvisorFilter}
                  onChange={(e) => setSelectedAdvisorFilter(e.target.value)}
                  className="w-full sm:w-48 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl focus:outline-hidden"
                >
                  <option value="ALL">All Advisors</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 w-full flex items-center">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by attendee, organisation, advisor, or slot note..."
                  className="w-full text-xs font-medium text-slate-800 placeholder-slate-400 pl-9 pr-4 py-2 focus:outline-hidden"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="text-xs text-slate-400 hover:text-slate-600 mr-2">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 uppercase font-bold text-[11px] tracking-wider">
                      <th className="py-3.5 px-4">Advisor</th>
                      <th className="py-3.5 px-4">Date & Time (SAST)</th>
                      <th className="py-3.5 px-4">Length</th>
                      <th className="py-3.5 px-4">Booker</th>
                      <th className="py-3.5 px-4">Organisation</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Email Status</th>
                      <th className="py-3.5 px-4">Sheet Sync</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingBookings && bookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                          <span>Loading clinic bookings...</span>
                        </td>
                      </tr>
                    ) : filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <span>No bookings found matching filter.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => {
                        const slot = Array.isArray(b.slots) ? b.slots[0] : b.slots;
                        const advisor = slot?.advisors ? (Array.isArray(slot.advisors) ? slot.advisors[0] : slot.advisors) : null;
                        const startDate = slot?.start_time ? new Date(slot.start_time) : null;
                        const endDate = slot?.end_time ? new Date(slot.end_time) : null;

                        const dateStr = startDate
                          ? startDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Harare" })
                          : "—";
                        const timeStr = startDate && endDate
                          ? `${startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Harare" })} - ${endDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Harare" })}`
                          : "—";

                        return (
                          <tr key={b.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="font-bold text-slate-900 block">{advisor?.full_name || "Silvia Guizzardi"}</span>
                              <span className="text-[11px] text-slate-400">{advisor?.job_title || "Senior Adviser"}</span>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap font-medium text-slate-900">
                              <div>{dateStr}</div>
                              <div className="text-blue-700 font-semibold text-[11px]">{timeStr}</div>
                              {slot?.note && (
                                <span className="inline-block mt-1 text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                  {slot.note}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-slate-600 whitespace-nowrap font-medium">
                              {slot?.duration_minutes ? `${slot.duration_minutes} min` : "—"}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{b.name}</div>
                              <a href={`mailto:${b.email}`} className="text-blue-600 hover:underline text-[11px]">
                                {b.email}
                              </a>
                            </td>
                            <td className="py-4 px-4 text-slate-700 font-semibold whitespace-nowrap">
                              {b.organisation}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  b.status === "confirmed"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    b.email_status === "sent"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : b.email_status === "failed"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                  title={b.email_error || undefined}
                                >
                                  {b.email_status || "pending"}
                                </span>
                                {b.email_error && (
                                  <span
                                    title={b.email_error}
                                    className="text-rose-500 cursor-help"
                                  >
                                    <AlertCircle className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                {b.status === "confirmed" && (
                                  <button
                                    onClick={() => handleResendEmail(b.id, b.name)}
                                    disabled={resendingId === b.id}
                                    title="Resend confirmation and calendar invite (.ics) to advisor and booker"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                                  >
                                    {resendingId === b.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                    ) : (
                                      <Send className="h-3 w-3" />
                                    )}
                                    <span>Resend</span>
                                  </button>
                                )}
                              </div>
                              {b.email_error && (
                                <p className="text-[10px] text-rose-600 max-w-[180px] truncate mt-0.5" title={b.email_error}>
                                  {b.email_error}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    b.sheet_sync_status === "synced"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : b.sheet_sync_status === "failed"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                  title={
                                    b.sheet_synced_at
                                      ? `Last synced: ${new Date(b.sheet_synced_at).toLocaleString()}`
                                      : b.sheet_sync_error || "Pending sync"
                                  }
                                >
                                  {b.sheet_sync_status || "pending"}
                                </span>
                                <button
                                  onClick={() => handleResyncBooking(b.id, b.name)}
                                  disabled={resyncingId === b.id}
                                  title="Resync this booking row to Google Sheet"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition cursor-pointer disabled:opacity-50"
                                >
                                  {resyncingId === b.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                  <span>Resync</span>
                                </button>
                              </div>
                              {b.sheet_sync_error && (
                                <p
                                  className="text-[10px] text-rose-600 max-w-[200px] truncate mt-0.5"
                                  title={b.sheet_sync_error}
                                >
                                  {b.sheet_sync_error}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              {b.status === "confirmed" && (
                                <button
                                  onClick={() => handleCancelBooking(b.id, b.name)}
                                  disabled={cancellingId === b.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                                  title="Cancel booking and free slot"
                                >
                                  {cancellingId === b.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                  <span>Cancel</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ADVISORS & CLINICS */}
        {activeTab === "advisors" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {advisors.map((advisor) => (
                <div key={advisor.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {advisor.photo_url ? (
                          <img
                            src={advisor.photo_url}
                            alt={advisor.full_name}
                            className="h-12 w-12 rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-bold flex items-center justify-center">
                            {advisor.full_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base">{advisor.full_name}</h3>
                          <p className="text-xs text-slate-500 font-semibold">{advisor.job_title}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleAdvisorActive(advisor)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                          advisor.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {advisor.is_active ? "Active" : "Inactive"}
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{advisor.email}</span>
                    </div>

                    <p className="mt-3 text-xs text-slate-600 line-clamp-3 italic">
                      "{advisor.bio}"
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Slots</span>
                        <span className="font-bold text-slate-800">{advisor.total_slots ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Open Slots</span>
                        <span className="font-bold text-emerald-600">{advisor.available_slots ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSlotTargetAdvisor(advisor)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Slots</span>
                    </button>

                    <button
                      onClick={() => handleOpenAdvisorModal(advisor)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT ADVISOR */}
        {showAdvisorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingAdvisor ? "Edit Advisor" : "Add New Advisor"}
                </h3>
                <button onClick={() => setShowAdvisorModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAdvisor} className="p-6 overflow-y-auto space-y-4 text-xs">
                {advisorFormError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {advisorFormError}
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={advFullName}
                    onChange={(e) => setAdvFullName(e.target.value)}
                    placeholder="e.g. Silvia Guizzardi"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={advJobTitle}
                    onChange={(e) => setAdvJobTitle(e.target.value)}
                    placeholder="e.g. Senior Adviser for Impact"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Notification Email *</label>
                  <input
                    type="email"
                    required
                    value={advEmail}
                    onChange={(e) => setAdvEmail(e.target.value)}
                    placeholder="advisor@oakfnd.ch"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Photo URL (Optional)</label>
                  <input
                    type="url"
                    value={advPhotoUrl}
                    onChange={(e) => setAdvPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Clinic Bio *</label>
                  <textarea
                    rows={6}
                    required
                    value={advBio}
                    onChange={(e) => setAdvBio(e.target.value)}
                    placeholder="Describe the focus of this clinic..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is-active-check"
                    checked={advIsActive}
                    onChange={(e) => setAdvIsActive(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <label htmlFor="is-active-check" className="font-semibold text-slate-700 text-xs cursor-pointer">
                    Active (visible on booking portal)
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAdvisorModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdvisor}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    {savingAdvisor ? "Saving..." : "Save Advisor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD SLOTS FOR ADVISOR */}
        {slotTargetAdvisor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Session Slot</h3>
                  <p className="text-[11px] text-slate-500">For {slotTargetAdvisor.full_name}</p>
                </div>
                <button onClick={() => setSlotTargetAdvisor(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSlot} className="p-6 space-y-4 text-xs">
                {slotError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {slotError}
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={slotStartTime}
                      onChange={(e) => setSlotStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">End Time *</label>
                    <input
                      type="time"
                      required
                      value={slotEndTime}
                      onChange={(e) => setSlotEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Duration (minutes) *</label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={240}
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Slot Note (Optional)</label>
                  <input
                    type="text"
                    value={slotNote}
                    onChange={(e) => setSlotNote(e.target.value)}
                    placeholder="e.g. Chat during tea break"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSlotTargetAdvisor(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSlot}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    {savingSlot ? "Adding..." : "Add Slot"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
