"use client";

import React from "react";
import { Calendar, FileText } from "lucide-react";
import { ProgrammeViewMode } from "@/lib/types/programme";

export interface ProgrammeToggleProps {
  activeView: ProgrammeViewMode;
  onViewChange: (view: ProgrammeViewMode) => void;
  className?: string;
}

export function ProgrammeToggle({
  activeView,
  onViewChange,
  className = "",
}: ProgrammeToggleProps) {
  return (
    <div
      className={`inline-flex items-center p-1 bg-input-bg border border-border rounded-xl shadow-xs ${className}`}
      role="tablist"
      aria-label="Programme View Selector"
    >
      <button
        type="button"
        role="tab"
        id="tab-schedule"
        aria-selected={activeView === "schedule"}
        aria-controls="view-schedule"
        data-view="schedule"
        onClick={() => onViewChange("schedule")}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer select-none ${
          activeView === "schedule"
            ? "bg-primary text-white shadow-sm"
            : "text-text-muted hover:text-text-heading hover:bg-surface/60"
        }`}
      >
        <Calendar className="w-4 h-4 shrink-0" />
        <span>Schedule</span>
      </button>

      <button
        type="button"
        role="tab"
        id="tab-docs"
        aria-selected={activeView === "docs"}
        aria-controls="view-docs"
        data-view="docs"
        onClick={() => onViewChange("docs")}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer select-none ${
          activeView === "docs"
            ? "bg-primary text-white shadow-sm"
            : "text-text-muted hover:text-text-heading hover:bg-surface/60"
        }`}
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span>Docs</span>
      </button>
    </div>
  );
}

export default ProgrammeToggle;
