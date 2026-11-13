import type { Metadata, Viewport } from "next";
import { Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';

import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, CalendarDays } from "lucide-react";

const calibri = localFont({
  src: [
    { path: "../../public/fonts/calibri/calibri-regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/calibri/calibri-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/calibri/calibri-bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/calibri/calibri-bold-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-calibri",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OAK Grantee Convening 2026",
  description: "Attendee Registration and Management",
  icons: {
    icon: [
      { url: "/oak-event-logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/oak-event-logo.svg",
    apple: "/oak-event-logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1C2A48",
};

// Force Dev Server Rebuild
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // Extensions add attributes here before hydration; keep suppression at the root only.
      suppressHydrationWarning
      className={`${calibri.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col lg:flex-row bg-background text-text-body">
          {/* Mobile Header */}
          <div className="mobile-header lg:hidden flex flex-wrap items-center gap-2.5 bg-[#1C2E5A] text-white px-4 py-3 sticky top-0 z-40 print:hidden">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/oak-event-logo-white.svg"
                alt="OAK Foundation Logo"
                width={36}
                height={44}
                className="object-contain w-auto h-9"
                priority
              />
            </Link>
            <div className="w-px h-6 bg-white/20"></div>
            <span className="min-w-0 flex-1 font-sans text-[11px] leading-4 tracking-[1.2px] uppercase font-semibold text-white/90 truncate">
              Grantee Convening 2026
            </span>
            <Link
              href="/programme"
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/20 shrink-0"
              title="Programme"
            >
              <CalendarDays className="w-3.5 h-3.5 text-blue-200" />
              <span>Programme</span>
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/20 shrink-0"
              title="Privacy Policy"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Privacy</span>
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-white/30 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Admin
            </Link>
          </div>

          <Sidebar />
          
          <main id="main-content" className="app-content min-w-0 w-full flex-1 flex flex-col justify-between min-h-dvh lg:ml-[256px] lg:w-[calc(100%-256px)] print:ml-0 print:w-full print:p-0">
            <div className="flex-1 w-full">
              {children}
            </div>

            {/* Consistent Global Footer */}
            <footer className="w-full border-t border-slate-200/80 bg-white/70 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 mt-auto print:hidden">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <span>&copy; 2026 OAK Foundation · Grantee Convening 2026</span>
                <div className="flex items-center gap-3.5 flex-wrap justify-center">
                  <Link
                    href="/privacy"
                    className="font-bold text-[#1C2E5A] hover:underline flex items-center gap-1.5 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Privacy Policy</span>
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link href="/programme" className="hover:text-[#1C2E5A] transition">
                    Programme
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link href="/directory" className="hover:text-[#1C2E5A] transition">
                    Grantees
                  </Link>
                  <span className="text-slate-300">•</span>
                  <Link href="/terms" className="hover:text-[#1C2E5A] transition">
                    Terms
                  </Link>
                </div>
              </div>
            </footer>
          </main>
      </body>
    </html>
  );
}

