'use client';

import { useState } from 'react';
import { downloadTicket } from '@/lib/ticket/downloadTicket';

interface QrDownloadButtonProps {
  attendeeName: string;
  eventCode: string;
  organization?: string;
  role?: string;
}

export function QrDownloadButton({
  attendeeName,
  eventCode,
  organization = 'OAK Grantee Convening',
  role = 'Grantee',
}: QrDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const parts = attendeeName.trim().split(/\s+/);
      const firstName = parts[0] || 'Attendee';
      const lastName = parts.slice(1).join(' ') || '';

      await downloadTicket({
        firstName,
        lastName,
        organization,
        role,
        registrationId: eventCode,
        qrCodeId: eventCode,
        location: 'Harare, Zimbabwe',
      });
    } catch (err) {
      console.error('Failed to download ticket:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="w-full bg-[#1d365d] hover:bg-[#17304f] text-white font-medium py-3.5 px-6 rounded-[18px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(29,54,93,0.12)] transition-colors text-sm cursor-pointer disabled:opacity-75"
      type="button"
    >
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{downloading ? 'Preparing Ticket...' : 'Download Entry Ticket'}</span>
    </button>
  );
}
