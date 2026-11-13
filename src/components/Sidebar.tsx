"use client";

import { REGISTRATION_OPEN } from "@/lib/registration";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Globe,
  Scan,
  UserPlus,
  LogIn,
  ShieldCheck,
  Clock,
  LayoutDashboard,
  Users,
  Tag,
  Mail,
  ExternalLink,
  CalendarCheck,
  LogOut,
  Ticket,
  Shield,
  ShieldAlert,
  Activity,
  FolderOpen,
  Mic,
  Contact,
  Shuffle,
  MessageSquareHeart,
} from "lucide-react";
import { getSessionStatus } from "@/lib/session";

export type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  imgIcon?: string;
  activePaths?: string[];
  badge?: string;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export function Sidebar() {
  const pathname = usePathname();
  const [isStaff, setIsStaff] = React.useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [superAdminView, setSuperAdminView] = React.useState<"admin" | "superadmin">("admin");
  const [passId, setPassId] = React.useState<string | null>(null);
  const [isRegistered, setIsRegistered] = React.useState(false);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  // Sync superadmin view mode from custom events (only active when user is verified superadmin)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const handleViewChange = (e: any) => {
        if (!isSuperAdmin) return;
        if (e.detail?.mode === "admin" || e.detail?.mode === "superadmin") {
          setSuperAdminView(e.detail.mode);
        }
      };
      window.addEventListener("oak-dashboard-view-changed", handleViewChange);
      return () => {
        window.removeEventListener("oak-dashboard-view-changed", handleViewChange);
      };
    }
  }, [isSuperAdmin]);

  const toggleSuperAdminView = (mode: "admin" | "superadmin") => {
    if (!isSuperAdmin) return;
    setSuperAdminView(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("oak_superadmin_view_mode", mode);
      window.dispatchEvent(new CustomEvent("oak-dashboard-view-changed", { detail: { mode } }));
    }
  };

  React.useEffect(() => {
    let mounted = true;

    const checkStaff = async (attempt = 0) => {
      try {
        const status = await getSessionStatus();
        if (mounted) {
          setIsStaff(status.isStaff);
          const superAdmin = Boolean(status.isSuperAdmin);
          setIsSuperAdmin(superAdmin);
          if (superAdmin && typeof window !== "undefined") {
            const saved = localStorage.getItem("oak_superadmin_view_mode");
            if (saved === "admin" || saved === "superadmin") {
              setSuperAdminView(saved);
            }
          } else {
            setSuperAdminView("admin");
          }
          setPassId(status.partnerId);
          setIsRegistered(Boolean(status.isRegistered || status.isStaff || status.partnerId));
          if (status.attendee) {
            setUserName(status.attendee.name || null);
            setUserEmail(status.attendee.email || null);
          }
        }
      } catch (err) {
        // A failed or slow check (e.g. a busy page firing several requests) says nothing about the
        // session, so keep the current navigation and retry instead of showing the signed-out menu.
        // Sign-out is handled by a successful check returning a signed-out status.
        console.warn("Failed to check auth state in sidebar, retrying", err);
        if (mounted && attempt < 2) {
          retryTimer = setTimeout(() => checkStaff(attempt + 1), 2000);
        }
      }
    };

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    checkStaff();
    const onAuthChanged = () => checkStaff();
    window.addEventListener("oak-admin-auth-changed", onAuthChanged);
    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("oak-admin-auth-changed", onAuthChanged);
    };
  }, [pathname]);

  const isAuth = isStaff || Boolean(passId) || isRegistered;

  // Active link matcher (handles query parameters e.g. /admin?view=super)
  const isItemActive = (item: NavItem) => {
    const paths = item.activePaths ?? [item.href];

    return paths.some((path) => {
      if (path.includes("?")) {
        const [targetPath, targetQuery] = path.split("?");
        if (typeof window !== "undefined") {
          return pathname === targetPath && window.location.search.includes(targetQuery);
        }
        return pathname === targetPath;
      }
      if (path === "/" || path === "/admin") {
        return pathname === path;
      }
      return pathname === path || pathname.startsWith(`${path}/`);
    });
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on signout
    }
    window.dispatchEvent(new Event("oak-admin-auth-changed"));
    window.location.href = isStaff ? "/admin/login" : "/";
  };

  // ==========================================
  // NAVIGATION SECTIONS BUILDER
  // ==========================================
  // 1. Regular Staff Admin navigation
  const regularAdminSections: NavSection[] = [
    {
      title: "Operations & Check-In",
      items: [
        { name: "Attendance", href: "/admin", icon: LayoutDashboard, activePaths: ["/admin"] },
        { name: "QR Scanner", href: "/admin/scan", icon: Scan, activePaths: ["/admin/scan"] },
        { name: "Attendees", href: "/admin/attendees", icon: Users, activePaths: ["/admin/attendees"] },
        { name: "Nametags & Badges", href: "/admin/nametags", icon: Tag, activePaths: ["/admin/nametags"] },
      ],
    },
    {
      title: "Clinics & Schedule",
      items: [
        { name: "1:1 Bookings", href: "/admin/bookings", icon: CalendarCheck, activePaths: ["/admin/bookings"] },
        { name: "Programme & Docs", href: "/admin/programme", icon: CalendarDays, activePaths: ["/admin/programme", "/admin/agenda"] },
        { name: "Breakout Groups", href: "/breakouts", icon: Shuffle, activePaths: ["/breakouts"] },
        { name: "Speaker Profiles", href: "/admin/people", icon: Contact, activePaths: ["/admin/people"] },
        { name: "Grantee Directory", href: "/admin/directory", icon: Globe, activePaths: ["/admin/directory", "/directory"] },
        { name: "Shared Files (Drive)", href: "/admin/drive", icon: FolderOpen, activePaths: ["/admin/drive"] },
        { name: "Review Uploads", href: "/admin/drive/review", icon: Clock, activePaths: ["/admin/drive/review"] },
        { name: "Feedback Results", href: "/admin/feedback", icon: MessageSquareHeart, activePaths: ["/admin/feedback"] },
      ],
    },
    {
      title: "Attendee Views",
      items: [
        { name: "1:1 Meetings View", href: "/book", icon: ExternalLink, activePaths: ["/book"] },
        ...(passId ? [{ name: "My Ticket Pass", href: `/pass/${passId}`, icon: Ticket, activePaths: ["/pass"] }] : []),
      ],
    },
  ];

  // 2. Super Admin navigation (when in Super Admin Mode)
  const superAdminFullSections: NavSection[] = [
    {
      title: "Super Admin Governance",
      items: [
        { name: "Super Overview", href: "/admin?view=super", icon: ShieldAlert, activePaths: ["/admin?view=super"] },
        { name: "Team & Permissions", href: "/admin/team", icon: Shield, activePaths: ["/admin/team"] },
        { name: "Activity & Audit", href: "/admin/activity", icon: Activity, activePaths: ["/admin/activity"] },
        { name: "Email Diagnostics", href: "/admin/email-test", icon: Mail, activePaths: ["/admin/email-test"] },
        { name: "Drive Infrastructure", href: "/admin/drive", icon: FolderOpen, activePaths: ["/admin/drive"] },
        { name: "Review Uploads", href: "/admin/drive/review", icon: Clock, activePaths: ["/admin/drive/review"] },
        { name: "Feedback Results", href: "/admin/feedback", icon: MessageSquareHeart, activePaths: ["/admin/feedback"] },
      ],
    },
    {
      title: "Operations & Check-In",
      items: [
        { name: "Attendance", href: "/admin?view=admin", icon: LayoutDashboard, activePaths: ["/admin", "/admin?view=admin"] },
        { name: "QR Scanner", href: "/admin/scan", icon: Scan, activePaths: ["/admin/scan"] },
        { name: "Attendees", href: "/admin/attendees", icon: Users, activePaths: ["/admin/attendees"] },
        { name: "Nametags & Badges", href: "/admin/nametags", icon: Tag, activePaths: ["/admin/nametags"] },
      ],
    },
    {
      title: "Clinics & Schedule",
      items: [
        { name: "1:1 Bookings", href: "/admin/bookings", icon: CalendarCheck, activePaths: ["/admin/bookings"] },
        { name: "Programme & Docs", href: "/admin/programme", icon: CalendarDays, activePaths: ["/admin/programme", "/admin/agenda"] },
        { name: "Breakout Groups", href: "/breakouts", icon: Shuffle, activePaths: ["/breakouts"] },
        { name: "Speaker Profiles", href: "/admin/people", icon: Contact, activePaths: ["/admin/people"] },
        { name: "Grantee Directory", href: "/admin/directory", icon: Globe, activePaths: ["/admin/directory", "/directory"] },
      ],
    },
    {
      title: "Attendee Views",
      items: [
        { name: "1:1 Meetings View", href: "/book", icon: ExternalLink, activePaths: ["/book"] },
        ...(passId ? [{ name: "My Ticket Pass", href: `/pass/${passId}`, icon: Ticket, activePaths: ["/pass"] }] : []),
      ],
    },
  ];

  // Determine active admin sections based on superadmin view toggle
  const adminSections =
    isSuperAdmin && superAdminView === "superadmin"
      ? superAdminFullSections
      : regularAdminSections;

  // Mobile Bottom Bar items
  const adminMobileItems: NavItem[] =
    isSuperAdmin && superAdminView === "superadmin"
      ? [
          { name: "Super", href: "/admin?view=super", icon: ShieldAlert, activePaths: ["/admin?view=super"] },
          { name: "Team", href: "/admin/team", icon: Shield, activePaths: ["/admin/team"] },
          { name: "Audit", href: "/admin/activity", icon: Activity, activePaths: ["/admin/activity"] },
          { name: "Attendance", href: "/admin?view=admin", icon: LayoutDashboard, activePaths: ["/admin"] },
          { name: "Scanner", href: "/admin/scan", icon: Scan, activePaths: ["/admin/scan"] },
        ]
      : [
          { name: "Overview", href: "/admin", icon: LayoutDashboard, activePaths: ["/admin"] },
          { name: "Scanner", href: "/admin/scan", icon: Scan, activePaths: ["/admin/scan"] },
          { name: "Attendees", href: "/admin/attendees", icon: Users, activePaths: ["/admin/attendees"] },
          { name: "Bookings", href: "/admin/bookings", icon: CalendarCheck, activePaths: ["/admin/bookings"] },
          { name: "Programme", href: "/admin/programme", icon: CalendarDays, activePaths: ["/admin/programme", "/admin/agenda"] },
        ];

  // ==========================================
  // PUBLIC / ATTENDEE NAVIGATION
  // ==========================================
  const isRegisterPage = pathname === "/register" || pathname === "/";
  const showSharedFiles = isAuth && !isRegisterPage;

  const attendeeItems: NavItem[] = [
    ...(passId ? [{ name: "My Ticket", href: `/pass/${passId}`, icon: Ticket, activePaths: ["/pass"] }] : []),
    ...(isAuth ? [{ name: "1:1 Meetings", href: "/book", icon: Clock, activePaths: ["/book"] }] : []),
    { name: "Programme", href: "/programme", icon: CalendarDays, activePaths: ["/programme"] },
    { name: "Speakers", href: "/speakers", icon: Mic, activePaths: ["/speakers"] },
    ...(isAuth ? [{ name: "Breakout Groups", href: "/breakouts", icon: Shuffle, activePaths: ["/breakouts"] }] : []),
    ...(showSharedFiles ? [{ name: "Shared Files", href: "/drive", icon: FolderOpen, activePaths: ["/drive"] }] : []),
    ...(isAuth ? [{ name: "Grantees", href: "/directory", icon: Globe, activePaths: ["/directory"] }] : []),
    ...(isAuth ? [{ name: "Feedback", href: "/feedback", icon: MessageSquareHeart, activePaths: ["/feedback"] }] : []),
    ...(!isAuth ? [
      ...(REGISTRATION_OPEN ? [{ name: "Register", href: "/register", icon: UserPlus, activePaths: ["/", "/register"] }] : []),
      { name: "Sign In", href: "/admin/login", icon: LogIn, activePaths: ["/admin/login"] },
    ] : []),
  ];

  const mobileItems = isStaff ? adminMobileItems : attendeeItems;

  return (
    <>
      {/* Desktop Sidebar (Left Fixed) */}
      <aside className="hidden lg:flex w-[256px] bg-white border-r border-slate-200/90 flex-col h-dvh fixed left-0 top-0 justify-between z-30 shadow-2xs print:hidden">
        {/* Scrollable Upper Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:#e2e8f0_transparent]">
          {/* Header Brand */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <Link href={isStaff ? "/admin" : "/"} className="inline-flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-[#162E55] flex items-center justify-center p-2 shadow-xs transition-transform group-hover:scale-105 shrink-0">
                <Image
                  src="/oak-event-logo-white.svg"
                  alt="OAK Foundation Logo"
                  width={32}
                  height={40}
                  className="object-contain w-auto h-full"
                  priority
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-sans font-extrabold text-[17px] leading-none text-[#0E1726] tracking-tight">OAK</span>
                  <span className="font-sans font-semibold text-[10px] leading-none text-[#6B7590] tracking-wider uppercase">Foundation</span>
                </div>
                {isStaff ? (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-[10px] uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>Super Admin</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px] uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Admin Portal</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="font-sans font-semibold text-[11px] leading-tight tracking-[1px] uppercase text-[#6B7590] mt-1 truncate">
                    Convening 2026
                  </p>
                )}
              </div>
            </Link>

            {/* Super Admin Dashboard Mode Switcher Toggle */}
            {isSuperAdmin && (
              <div className="mt-3.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleSuperAdminView("admin")}
                  title="Switch to regular staff admin dashboard & navigation"
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    superAdminView === "admin"
                      ? "bg-white text-[#162E55] shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="w-3 h-3" />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSuperAdminView("superadmin")}
                  title="Switch to superadmin command center & system controls"
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    superAdminView === "superadmin"
                      ? "bg-[#162E55] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <ShieldAlert className="w-3 h-3 text-amber-300" />
                  <span>Super</span>
                </button>
              </div>
            )}
          </div>

          {/* Navigation Section */}
          <nav className="px-3.5 py-4 flex-1">
            {isStaff ? (
              // Structured Admin Navigation
              <div className="space-y-5">
                {adminSections.map((section, idx) => (
                  <div key={section.title || idx}>
                    {section.title && (
                      <h3 className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                        {section.title}
                      </h3>
                    )}
                    <ul className="space-y-0.5">
                      {section.items.map((item) => {
                        const isActive = isItemActive(item);
                        return (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              aria-current={isActive ? "page" : undefined}
                              className={`flex items-center gap-3 w-full h-[38px] px-3 rounded-xl font-sans text-[13px] transition-all cursor-pointer ${
                                isActive
                                  ? "bg-[#162E55] text-white shadow-xs font-bold"
                                  : "text-slate-600 font-semibold hover:text-slate-900 hover:bg-slate-100/75"
                              }`}
                            >
                              <item.icon
                                className={`w-4 h-4 shrink-0 transition-colors ${
                                  isActive ? "text-white stroke-[2.2]" : "text-slate-500 stroke-[1.8]"
                                }`}
                              />
                              <span className="truncate leading-none">{item.name}</span>
                              {item.badge && (
                                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                {/* Helper notice when Super Admin is viewing in Staff Admin Mode */}
                {isSuperAdmin && superAdminView === "admin" && (
                  <div className="mx-1 mt-4 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                      <span>Staff Admin Mode</span>
                    </div>
                    <p className="text-amber-800/80 leading-relaxed text-[10px]">
                      Viewing platform as regular staff. Click <strong>Super</strong> above anytime to return to the superadmin command center.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Clean Attendee Navigation
              <ul className="space-y-1">
                {attendeeItems.map((item) => {
                  const isActive = isItemActive(item);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-3 w-full h-[42px] px-3.5 rounded-xl font-sans text-[14px] transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#162E55] text-white shadow-sm font-bold"
                            : "text-slate-600 font-semibold hover:text-slate-900 hover:bg-slate-100/75"
                        }`}
                      >
                        <item.icon
                          className={`w-4.5 h-4.5 shrink-0 ${
                            isActive ? "text-white stroke-[2.2]" : "text-slate-500 stroke-[1.8]"
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </div>

        {/* Footer / Session Section */}
        <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex flex-col gap-2.5">
          {/* Staff Session Card */}
          {isStaff && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#162E55] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    {userName ? userName.charAt(0).toUpperCase() : <Shield className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                      {userName || "Staff Member"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate leading-tight">
                      {userEmail || "Coordination Team"}
                    </p>
                  </div>
                </div>
                <span className="flex h-2 w-2 relative shrink-0" title="Active Staff Session">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full mt-0.5 py-1.5 px-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-700 text-[11px] font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Attendee Ticket Session Card */}
          {passId && !isStaff && (
            <div className="pb-2 border-b border-slate-100 flex items-center justify-between text-xs">
              <Link href={`/pass/${passId}`} className="font-semibold text-[#162E55] hover:underline truncate text-xs flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-[#162E55] shrink-0" />
                <span className="truncate">Ticket: {passId}</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="text-slate-400 hover:text-red-600 text-[11px] font-semibold cursor-pointer shrink-0 ml-2"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Location & Copyright */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1 pt-0.5">
            <div className="flex items-center gap-1.5 truncate">
              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Harare, Zimbabwe</span>
            </div>
            <Link
              href="/privacy"
              className="text-slate-500 hover:text-[#162E55] font-semibold transition shrink-0 ml-2"
            >
              Privacy
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="mobile-nav lg:hidden fixed left-0 right-0 bottom-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] print:hidden"
      >
        <ul
          className="grid h-[64px] pb-1"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
        >
          {mobileItems.map((item) => {
            const isActive = isItemActive(item);

            return (
              <li key={item.name} className="flex flex-col items-center justify-center h-full w-full">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="flex flex-col items-center justify-center w-full h-full transition-colors cursor-pointer touch-manipulation py-1"
                >
                  <div
                    className={`flex flex-col items-center justify-center gap-1 transition-all ${
                      isActive ? "text-[#162E55]" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.2]" : "stroke-[1.6]"}`} />
                    <span
                      className={`text-[10px] leading-none tracking-tight font-sans truncate max-w-[62px] ${
                        isActive ? "font-bold text-[#162E55]" : "font-medium"
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
