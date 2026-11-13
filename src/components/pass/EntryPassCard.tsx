"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Image from "next/image";
import type { AttendeeRecord } from "@/lib/mockApi";
import { downloadTicket } from "@/lib/ticket/downloadTicket";

interface EntryPassCardProps {
  attendee: AttendeeRecord;
}

export function EntryPassCard({ attendee }: EntryPassCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadTicket({
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        organization: attendee.organization,
        role: attendee.role,
        registrationId: attendee.registrationId,
        qrCodeId: attendee.qrCodeId,
        location: "Harare, Zimbabwe",
      });
    } catch (err) {
      console.error("Failed to generate ticket:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <section className="bg-white md:bg-[#f9f8f5] rounded-[24px] border border-slate-100 md:border-[#eae3d9] p-6 md:p-8 text-center flex flex-col items-center w-full shadow-[0_4px_20px_rgba(28,46,90,0.04)] md:shadow-none" data-purpose="entry-pass-card">
        <h2 className="font-sans font-semibold text-[10px] leading-[15px] tracking-[1px] text-[#6B7590] uppercase w-[107px] h-[15px] whitespace-nowrap">
          YOUR ENTRY PASS
        </h2>
        <div className="inline-block p-4 rounded-[28px] bg-[#F4F6F8] md:bg-[#edf1f4] my-[16px] border border-slate-100 md:border-[#e4e8ee]">
          <QRCodeCanvas
            id="qr-canvas"
            value={attendee.qrCodeId || attendee.registrationId}
            size={260}
            style={{ width: '180px', height: '180px' }}
            level="M"
            fgColor="#1C2E5A"
            bgColor="#F4F6F8"
          />
        </div>
        <p className="font-[Consolas] font-normal text-[12px] leading-[16px] tracking-[2.16px] text-[#6B7590] uppercase mb-2">
          {attendee.registrationId}
        </p>
        <p className="font-sans font-normal text-[12px] leading-[16px] tracking-normal text-[#6B7590]">
          Present at event entrance for check-in
        </p>
      </section>

      <section className="box-border bg-white w-full max-w-[608px] min-h-[290px] rounded-[24px] border border-[#1C2E5A1A] p-[20px] opacity-100 shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D]" data-purpose="registration-details-card">
        <h2 className="font-sans font-semibold text-[10px] leading-[15px] tracking-[1px] text-[#6B7590] uppercase mb-[13px] whitespace-nowrap">
          REGISTRATION DETAILS
        </h2>
        <dl className="text-sm divide-y divide-slate-100 md:divide-[#ece7df]">
          {[
            ["Name", `${attendee.firstName} ${attendee.lastName}`],
            ["Organisation", attendee.organization || "Not provided"],
            ["Role", attendee.role],
            ["Email", attendee.email || "Private — visible to the registering browser or staff"],
            ["Event Dates", "9–11 November 2026"],
            ["Location", "Harare, Zimbabwe"],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4 py-2 min-h-[37px] font-sans text-[14px] leading-[20px]">
              <dt className="font-normal text-[#6B7590]">{label}</dt>
              <dd className="min-w-0 font-medium text-right text-[#0E1726] [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="space-y-4 pt-2 w-full pb-[100px] md:pb-0" data-purpose="card-actions">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full md:w-[608px] h-[56px] py-[16px] bg-[#1C2E5A] md:bg-[#162E55] hover:opacity-90 text-white font-semibold text-[16px] leading-[24px] tracking-normal rounded-[16px] flex items-center justify-center gap-[10px] transition-colors cursor-pointer shadow-[0_4px_20px_rgba(28,46,90,0.3)] md:shadow-none disabled:opacity-75"
          style={{ fontFamily: 'var(--font-sans)' }}
          type="button"
        >
          <Image src="/download-icon.png" alt="Download" width={18} height={18} className="w-[18px] h-[18px] object-contain shrink-0" />
          <span>{isDownloading ? 'Preparing Ticket...' : 'Download Entry Ticket'}</span>
        </button>
      </div>
    </>
  );
}
