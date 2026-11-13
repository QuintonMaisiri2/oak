"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Calendar, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

export interface Advisor {
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

interface AdvisorCardProps {
  advisor: Advisor;
  onBookClick?: () => void;
}

export function AdvisorCard({ advisor, onBookClick }: AdvisorCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Generate initials for fallback avatar
  const initials = advisor.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const previewBio = advisor.bio.length > 240 ? `${advisor.bio.slice(0, 240)}...` : advisor.bio;
  const isTruncated = advisor.bio.length > 240;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Advisor Header */}
        <div className="flex items-start gap-4">
          {advisor.photo_url ? (
            <img
              src={advisor.photo_url}
              alt={advisor.full_name}
              className="h-16 w-16 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs"
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-2xs">
              {initials || <User className="h-7 w-7" />}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                OAK Advisor Clinic
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1 truncate">
              {advisor.full_name}
            </h3>
            <p className="text-xs font-semibold text-slate-500 truncate">
              {advisor.job_title}
            </p>
          </div>
        </div>

        {/* Bio Section with Read More toggle */}
        <div className="mt-5 text-xs text-slate-600 leading-relaxed">
          <p className="whitespace-pre-line">
            {expanded ? advisor.bio : previewBio}
          </p>
          {isTruncated && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{expanded ? "Show less" : "Read full bio"}</span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Footer / CTA */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Calendar className="h-3.5 w-3.5 text-blue-600" />
          <span>
            <strong className="text-slate-800">{advisor.available_slots ?? 0}</strong> slots open
          </span>
        </div>

        {onBookClick ? (
          <button
            onClick={onBookClick}
            className="px-4 py-2.5 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Book a session</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link
            href={`/book/${advisor.slug}`}
            className="px-4 py-2.5 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Book a session</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
