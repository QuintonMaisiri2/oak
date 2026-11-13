"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Ticket, ShieldAlert, LayoutDashboard, ArrowRight } from "lucide-react";
import { AttendanceList } from "@/components/dashboard/AttendanceList";
import { SuperAdminDashboardView } from "@/components/admin/SuperAdminDashboardView";
import type { AttendeeRecord } from "@/lib/mockApi";
import { clearAdminSession, getSessionStatus } from "@/lib/session";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [passId, setPassId] = useState<string | null>(null);

  // View mode switcher: 'admin' (Staff operational view) or 'superadmin' (System governance view)
  const [viewMode, setViewMode] = useState<"admin" | "superadmin">("admin");

  // Enforce admin/staff access check
  useEffect(() => {
    let mounted = true;
    getSessionStatus()
      .then(({ isStaff, isSuperAdmin: superAdminRole, partnerId }) => {
        if (!mounted) return;
        if (!isStaff) {
          router.replace("/admin/login?next=/admin");
        } else {
          setIsAuthorized(true);
          const superAdmin = Boolean(superAdminRole);
          setIsSuperAdmin(superAdmin);
          setPassId(partnerId);

          // Check URL query param or saved preference ONLY for superadmin
          if (superAdmin && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const viewParam = params.get("view");
            if (viewParam === "super" || viewParam === "superadmin") {
              setViewMode("superadmin");
            } else if (viewParam === "admin") {
              setViewMode("admin");
            } else {
              const savedMode = localStorage.getItem("oak_superadmin_view_mode");
              if (savedMode === "superadmin" || savedMode === "admin") {
                setViewMode(savedMode);
              } else {
                setViewMode("superadmin");
              }
            }
          } else {
            // Strictly enforce admin mode for non-superadmins
            setViewMode("admin");
          }
        }
      })
      .catch(() => {
        if (mounted) router.replace("/admin/login?next=/admin");
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  // Listen for view mode changes from the Sidebar switcher (strictly guarded for superadmin)
  useEffect(() => {
    const handleViewChange = (e: Event & { detail?: { mode?: "admin" | "superadmin" } }) => {
      if (!isSuperAdmin) return;
      if (e.detail?.mode === "admin" || e.detail?.mode === "superadmin") {
        setViewMode(e.detail.mode);
      }
    };
    window.addEventListener("oak-dashboard-view-changed", handleViewChange);
    return () => {
      window.removeEventListener("oak-dashboard-view-changed", handleViewChange);
    };
  }, [isSuperAdmin]);

  const handleSwitchMode = (mode: "admin" | "superadmin") => {
    if (!isSuperAdmin) return;
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("oak_superadmin_view_mode", mode);
      window.dispatchEvent(new CustomEvent("oak-dashboard-view-changed", { detail: { mode } }));
    }
  };

  // Load attendance data only when authenticated as staff
  useEffect(() => {
    if (!isAuthorized) return;
    let mounted = true;
    async function loadStats() {
      try {
        if (mounted) setError(null);
        const { getAllAttendees } = await import("@/lib/mockApi");
        const data = await getAllAttendees();
        if (mounted) {
          setAttendees(data);
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : "Failed to load attendees";
          if (
            message.includes("401") ||
            message.includes("403") ||
            message.includes("Authentication") ||
            message.includes("Staff")
          ) {
            router.replace("/admin/login?next=/admin");
            return;
          }
          setError(message || "Failed to load attendees");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStats();

    const handleUpdate = () => {
      loadStats();
    };

    window.addEventListener("oak-attendance-update", handleUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("oak-attendance-update", handleUpdate);
    };
  }, [isAuthorized, router]);

  const handleSignOut = async () => {
    try {
      await clearAdminSession();
    } catch {
      setError("Unable to sign out. Please try again.");
      return;
    }
    window.dispatchEvent(new Event("oak-admin-auth-changed"));
    router.push("/admin/login");
    router.refresh();
  };

  if (isAuthorized !== true) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Superadmin Mode Switcher Bar */}
      {isSuperAdmin && (
        <div className="mb-6 p-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">
              Dashboard View:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => handleSwitchMode("admin")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "admin"
                    ? "bg-white text-[#1C2C4F] shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Staff Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("superadmin")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "superadmin"
                    ? "bg-[#1C2C4F] text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                <span>Super Admin</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
            <span>
              {viewMode === "admin" ? (
                <>
                  Viewing as <strong>Staff Admin</strong> (Check-in & Operations)
                </>
              ) : (
                <>
                  Viewing as <strong>Super Admin</strong> (System Governance & Controls)
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Conditionally render Superadmin Command Center vs Staff Admin Attendance Dashboard */}
      {isSuperAdmin && viewMode === "superadmin" ? (
        <SuperAdminDashboardView
          attendees={attendees}
          onSwitchToAdmin={() => handleSwitchMode("admin")}
        />
      ) : (
        /* Staff Admin Dashboard View */
        <>
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Staff Operations
                </span>
                {isSuperAdmin && (
                  <button
                    onClick={() => handleSwitchMode("superadmin")}
                    className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Switch to Super Admin</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <h1
                className="text-[26px] sm:text-[28px] font-bold leading-tight tracking-normal text-[#0E1726]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Attendance & Operations
              </h1>
              <p className="font-sans text-[14px] font-normal leading-[20px] tracking-normal text-[#6B7590] mt-1">
                Check-in tracking · 9–11 November 2026
              </p>
            </div>

            <div className="flex items-center gap-2">
              {passId && (
                <Link
                  href={`/pass/${passId}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  <span>My Ticket</span>
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-sm cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </header>

          {loading ? (
            <section className="mb-5 flex h-[332px] w-full flex-col items-center justify-center gap-4 rounded-[28px] sm:rounded-[32px] bg-white p-[40px] border border-[#1C2E5A1A] text-center shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D]">
              <div className="w-16 h-16 rounded-[22px] bg-[#EEF2F6] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-slate-200 border-t-[#162E55]"></div>
              </div>
            </section>
          ) : error ? (
            <section className="mb-5 flex h-[332px] w-full flex-col items-center justify-center gap-4 rounded-[24px] bg-white p-[40px] border border-[#1C2E5A1A] text-center shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D]">
              <div className="flex h-[80px] w-[80px] items-center justify-center rounded-[24px] bg-red-50 text-red-500 shrink-0 mb-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-[15px] text-red-500 font-medium max-w-[320px]">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-primary text-white rounded-xl font-semibold hover:opacity-90 cursor-pointer"
              >
                Try Again
              </button>
            </section>
          ) : (
            <AttendanceList attendees={attendees} />
          )}
        </>
      )}
    </div>
  );
}
