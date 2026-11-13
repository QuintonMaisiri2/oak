'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Shield, Scan, Users, LayoutDashboard, Ticket, Clock } from 'lucide-react';
import { getSessionStatus } from '@/lib/session';

interface AdminHeaderProps {
  userEmail?: string | null;
}

export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const router = useRouter();
  const [passId, setPassId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSessionStatus()
      .then(({ partnerId }) => {
        if (mounted) setPassId(partnerId);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="border-b border-border bg-white sticky top-0 z-30 px-4 py-2.5 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1C2C4F] text-white">
          <Shield className="h-4 w-4" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-text-heading">
          Coordination Portal
        </span>
        <span className="hidden sm:inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
          Live
        </span>
      </div>

      <div className="flex items-center gap-4">
        {userEmail && (
          <span className="hidden md:inline-block text-xs font-medium text-text-muted">
            {userEmail}
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {passId && (
            <Link
              href={`/pass/${passId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1C2C4F] hover:bg-[#162844] transition shadow-xs"
            >
              <Ticket className="h-3.5 w-3.5" />
              <span>My Ticket</span>
            </Link>
          )}
          <Link
            href="/admin/bookings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-body hover:bg-input-bg transition"
          >
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span className="hidden sm:inline">1:1 Bookings</span>
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-body hover:bg-input-bg transition"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </Link>
          <Link
            href="/admin/attendees"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-body hover:bg-input-bg transition"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Attendees</span>
          </Link>
          <Link
            href="/admin/scan"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-body hover:bg-input-bg transition"
          >
            <Scan className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Scanner</span>
          </Link>


        </div>
      </div>
    </div>
  );
}

