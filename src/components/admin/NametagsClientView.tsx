'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  Search,
  Filter,
  ArrowLeft,
  X,
  Users,
  Building2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Attendee } from '@/lib/types/domain';

interface NametagsClientViewProps {
  attendees: Attendee[];
}

const ROLES = ['All', 'Grantee', 'OAK Staff', 'Coordination Team', 'Presenter', 'Observer'];

const ROLE_STYLES: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Grantee: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    accent: 'bg-blue-600',
  },
  'OAK Staff': {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    accent: 'bg-[#1C2C4F]',
  },
  'Coordination Team': {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    accent: 'bg-purple-700',
  },
  Presenter: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    accent: 'bg-amber-600',
  },
  Observer: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    accent: 'bg-slate-600',
  },
};

function getNameSizeClass(name: string = ''): string {
  const len = name.trim().length;
  if (len > 28) return 'text-base sm:text-lg print:text-[15px]';
  if (len > 18) return 'text-lg sm:text-xl print:text-[17px]';
  return 'text-xl sm:text-2xl print:text-[19px]';
}

export function NametagsClientView({ attendees }: NametagsClientViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [printingSingleId, setPrintingSingleId] = useState<string | null>(null);

  const filteredAttendees = useMemo(() => {
    return attendees.filter((a) => {
      if (selectedRole !== 'All' && a.role !== selectedRole) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = (a.name || '').toLowerCase().includes(term);
        const matchesOrg = (a.organization || '').toLowerCase().includes(term);
        const matchesSubPartner = (a.subPartner || '').toLowerCase().includes(term);
        const matchesCode = (a.eventCode || '').toLowerCase().includes(term);

        if (!matchesName && !matchesOrg && !matchesSubPartner && !matchesCode) {
          return false;
        }
      }

      return true;
    });
  }, [attendees, selectedRole, searchTerm]);

  const handlePrintAll = () => {
    setPrintingSingleId(null);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintSingle = (id: string) => {
    setPrintingSingleId(id);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintingSingleId(null), 500);
    }, 50);
  };

  const displayedAttendees = printingSingleId
    ? filteredAttendees.filter((a) => a.id === printingSingleId)
    : filteredAttendees;

  return (
    <div className="page-container space-y-6 print:p-0 print:m-0 print:max-w-none print:w-full">
      {/* Top Header & Navigation (Hidden in Print) */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <Link href="/admin/attendees" className="hover:text-slate-600 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Attendees Table</span>
            </Link>
            <span>/</span>
            <span className="text-slate-600">Nametags</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Print Nametags
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1C2C4F] text-white">
              {filteredAttendees.length} Cards
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Batch nametag generator for Cresta Lodge Convening. Badges auto-scale to fit all participant names and
            organizations cleanly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/attendees"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            Attendee Table
          </Link>
          <button
            type="button"
            onClick={handlePrintAll}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1C2C4F] hover:bg-[#152240] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>
              Print {filteredAttendees.length === attendees.length ? 'All Nametags' : `${filteredAttendees.length} Filtered`}
            </span>
          </button>
        </div>
      </header>

      {/* Filter and Search Controls (Hidden in Print) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between print:hidden">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, organization, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] focus:bg-white transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-10 appearance-none pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 focus:border-[#1C2C4F] cursor-pointer"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === 'All' ? 'All Roles' : r}
                </option>
              ))}
            </select>
            <Filter className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {(searchTerm || selectedRole !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedRole('All');
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Grid of Badges: Formatted for A4 Sheet Printing (2 per row in print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 print:grid-cols-2 print:gap-3.5">
        {displayedAttendees.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-bold text-slate-800">No nametags match your filter</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting the search query or role filter.</p>
          </div>
        ) : (
          displayedAttendees.map((attendee) => {
            const roleStyle = ROLE_STYLES[attendee.role] || {
              bg: 'bg-slate-100',
              text: 'text-slate-700',
              border: 'border-slate-200',
              accent: 'bg-slate-600',
            };

            return (
              <div
                key={attendee.id}
                className="group relative rounded-2xl bg-white border-2 border-slate-200 p-5 shadow-2xs flex flex-col justify-between min-h-[250px] sm:min-h-[260px] overflow-hidden transition hover:border-[#1C2C4F]/40 hover:shadow-md print:shadow-none print:border-slate-300 print:rounded-xl print:p-3.5 print:min-h-0 print:h-[66mm] print:break-inside-avoid print:page-break-inside-avoid"
              >
                {/* Top Subtle Role Accent Stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${roleStyle.accent} print:h-1`}
                  aria-hidden="true"
                />

                {/* Header: Event Details & Role Badge */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[12px] text-[#1C2C4F] tracking-wider uppercase truncate print:text-[11px]">
                      OAK CONVENING
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium truncate print:text-[9px]">
                      9–11 Nov 2026 · Harare
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold border whitespace-nowrap print:text-[9px] print:px-2 ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                  >
                    {attendee.role}
                  </span>
                </div>

                {/* Center: Name & Organization (Dynamic auto-scaling font size to fit content) */}
                <div className="my-auto py-2.5 flex flex-col justify-center min-w-0">
                  <h2
                    className={`${getNameSizeClass(
                      attendee.name
                    )} font-black text-slate-900 leading-tight tracking-tight break-words`}
                  >
                    {attendee.name}
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1 line-clamp-2 break-words leading-snug print:text-[11px]">
                    {attendee.organization}
                  </p>
                  {attendee.subPartner && (
                    <p className="text-[11px] font-semibold text-blue-700 mt-1 line-clamp-1 flex items-center gap-1 print:text-[10px]">
                      <span className="text-slate-400 font-normal">Sub-partner:</span>
                      <span>{attendee.subPartner}</span>
                    </p>
                  )}
                </div>

                {/* Footer: Event Code & QR Code */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-[#1C2C4F] tracking-tight truncate print:text-[11px]">
                      {attendee.eventCode || 'NO-CODE'}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5 truncate print:text-[8px]">
                      Access Pass · Cresta Lodge
                    </p>
                  </div>
                  <div className="shrink-0 p-1 rounded-lg bg-slate-50 border border-slate-200/80">
                    <QRCodeSVG
                      value={attendee.eventCode || attendee.id}
                      size={42}
                      level="L"
                      fgColor="#1C2C4F"
                      bgColor="#F8FAFC"
                    />
                  </div>
                </div>

                {/* Screen-Only Single Print Action Button (Hidden in Print) */}
                <div className="absolute bottom-2 right-14 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  <button
                    type="button"
                    onClick={() => handlePrintSingle(attendee.id)}
                    title={`Print badge for ${attendee.name}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1C2C4F] text-white text-[10px] font-bold shadow-xs hover:bg-[#152240] transition"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
