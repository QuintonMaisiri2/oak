import { CheckCircle2, Scan, Users, AlertCircle, AlertTriangle } from "lucide-react";

export type CheckInResult = {
  status: "checked_in" | "already_checked_in";
  message: string;
  attendee: {
    id: string;
    name: string;
    organization: string;
    role: string;
    eventCode: string;
    email?: string;
  };
  checkIn?: {
    id: string;
    scannedAt: string;
    eventDay: string;
  };
  stats?: {
    checkedIn: number;
    total: number;
  };
};

interface ScanSuccessViewProps {
  lastResult: CheckInResult;
  resetScan: () => void;
}

export function ScanSuccessView({ lastResult, resetScan }: ScanSuccessViewProps) {
  const isAlreadyCheckedIn = lastResult.status === "already_checked_in";
  const rawDate = lastResult.checkIn?.scannedAt ? new Date(lastResult.checkIn.scannedAt) : new Date();
  const time = rawDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFormatted = rawDate.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const checkedInCount = lastResult.stats?.checkedIn ?? 74;
  const totalCount = lastResult.stats?.total ?? 110;
  const progressPercent = Math.min(100, Math.round((checkedInCount / Math.max(totalCount, 1)) * 100));

  return (
    <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 space-y-4 pb-[80px] md:pb-0">
      {/* Success / Status Banner */}
      <div
        className={`w-full max-w-[608px] ${
          isAlreadyCheckedIn
            ? "bg-gradient-to-br from-[#D97706] to-[#F59E0B]"
            : "bg-gradient-to-br from-[#059669] to-[#10B981]"
        } rounded-[20px] md:rounded-[24px] flex items-center gap-[12px] md:gap-[16px] shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D] relative overflow-hidden min-h-[96px] md:h-[107px] px-4 md:px-[20px] py-4 md:py-0`}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -right-[20%] md:-right-[15%] w-[240px] md:w-[280px] h-[240px] md:h-[280px] bg-white/10 rounded-full"></div>
        <div className="w-12 h-12 md:w-[56px] md:h-[56px] bg-white/20 rounded-[14px] md:rounded-[16px] flex items-center justify-center shrink-0 z-10 border border-white/20">
          {isAlreadyCheckedIn ? (
            <AlertCircle className="w-6 h-6 md:w-[30px] md:h-[30px] text-white" />
          ) : (
            <CheckCircle2 className="w-6 h-6 md:w-[30px] md:h-[30px] text-white" />
          )}
        </div>
        <div className="z-10 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] font-bold tracking-[1.5px] uppercase text-white/80 mb-0.5 md:mb-1 font-sans">
            {isAlreadyCheckedIn ? "Already Registered & Checked In" : "Pass Verified"}
          </p>
          <h2 className="text-[18px] md:text-[20px] leading-[24px] md:leading-[28px] font-bold text-white mb-1 tracking-normal font-sans">
            {isAlreadyCheckedIn ? "Already Checked In" : "Checked In Successfully"}
          </h2>
          <p className="text-[13px] md:text-[14px] leading-[18px] md:leading-[20px] text-[#FFFFFF99] md:text-[#FFFFFFCC] font-normal flex items-center gap-1.5 font-sans">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[10px] h-[10px] md:w-[11px] md:h-[11px]"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {isAlreadyCheckedIn ? `First checked in at ${time} · ${dateFormatted}` : `${time} · ${dateFormatted}`}
          </p>
        </div>
      </div>

      {/* Duplicate Notice Banner if already checked in */}
      {isAlreadyCheckedIn && (
        <div className="w-full max-w-[608px] bg-amber-50 border border-amber-200 rounded-[20px] p-4 flex items-start gap-3 text-amber-900 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm font-sans">
            <p className="font-semibold text-amber-950 text-[13px]">Duplicate Check-In Detected</p>
            <p className="text-amber-800 text-[12px] mt-0.5">
              This attendee was already checked in for {lastResult.checkIn?.eventDay ? `Day (${lastResult.checkIn.eventDay})` : "today"} at {time}. No duplicate record was created.
            </p>
          </div>
        </div>
      )}

      {/* Registration Details Card */}
      <section aria-labelledby="check-in-registration-details" className="w-full max-w-[608px] rounded-[24px] border border-[#1C2E5A1A] bg-white p-5 shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D]">
        <h3 id="check-in-registration-details" className="mb-3 font-sans text-[10px] font-semibold uppercase leading-[15px] tracking-[1px] text-[#6B7590]">
          Registration Details
        </h3>
        <dl className="divide-y divide-[#E5E8EE]">
          {[
            ["Name", lastResult.attendee.name || "Not provided"],
            ["Organisation", lastResult.attendee.organization || "Not provided"],
            ["Role", lastResult.attendee.role || "Not provided"],
            ["Email", lastResult.attendee.email || "Not provided"],
            ["Event Dates", "9–11 November 2026"],
            ["Location", "Harare, Zimbabwe"],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4 py-2 font-sans text-[14px] leading-5">
              <dt className="text-[#6B7590]">{label}</dt>
              <dd className="min-w-0 text-right font-medium text-[#0E1726] [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {/* Live Event Status Card */}
      <div className="w-full max-w-[608px] bg-white rounded-[20px] md:rounded-[24px] p-4 md:p-[20px] lg:p-6 shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D] border border-[#1C2E5A1A]">
        <p className="text-[9px] md:text-[10px] font-semibold tracking-[1px] text-[#6B7590] uppercase mb-3 md:mb-4 flex items-center gap-1.5 font-sans">
          <Users className="w-3 md:w-3.5 h-3 md:h-3.5 text-[#1C2E5A]" />
          Live Event Status
        </p>
        
        <div className="flex items-center gap-2 mb-2 md:mb-3">
          <div className="w-2 h-2 rounded-full bg-[#10B981] ring-[3px] ring-[#10B981]/20"></div>
          <p className="text-[13px] md:text-[14px] font-bold text-[#0E1726] font-sans">Opening Plenary starting at 09:30</p>
        </div>
        
        <p className="text-[11px] md:text-[12px] text-[#6B7590] mb-3 font-sans">
          {checkedInCount} of {totalCount} attendees checked in &middot; Main Hall A
        </p>
        
        <div className="w-full h-1.5 md:h-2 bg-[#EEF1F5] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#1C2C4F] rounded-full transition-all duration-500" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Action Button */}
      <div className="w-full max-w-[608px] mt-2 md:mt-0 sticky bottom-4 md:static z-10">
        <button
          onClick={resetScan}
          className="w-full h-[52px] bg-[#162E55] hover:bg-[#1C2E5A] active:scale-[0.98] text-white font-semibold md:font-bold text-[14px] md:text-[15px] rounded-[16px] flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_0_#1C2E5A4D] cursor-pointer font-sans"
        >
          <Scan className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          Scan Next Attendee
        </button>
      </div>
    </div>
  );
}
