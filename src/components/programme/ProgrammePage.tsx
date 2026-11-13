"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProgrammeDocs } from "./ProgrammeDocs";
import { Download, MapPin, Star, User, ChevronDown, ChevronUp, Pencil, Target, Shuffle, ChevronRight } from "lucide-react";
import { conveningObjectives } from "./data";
import { describeDayDate, getFeaturedSession } from "@/lib/programme/agenda";
import type { ScheduleDay } from "@/lib/types/programme";
import { createSpeakerMatcher, type PersonSummary } from "@/lib/people";
import { SpeakerList } from "@/components/people/SpeakerList";

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi"];

function getCategoryColor(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes('plenary') || cat.includes('panel')) return { dot: 'bg-[#1C2C4F]', bg: 'bg-[#F1F5F9]', text: 'text-[#1C2C4F]' };
  if (cat.includes('breakout')) return { dot: 'bg-[#FBBF24]', bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]' };
  if (cat.includes('workshop')) return { dot: 'bg-[#A855F7]', bg: 'bg-[#FAF5FF]', text: 'text-[#6B21A8]' };
  if (cat.includes('networking') || cat.includes('social')) return { dot: 'bg-[#FF8A65]', bg: 'bg-[#FFF5F2]', text: 'text-[#C2410C]' };
  return { dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-700' };
}

export default function ProgrammePage({ days, people = [], adminView = false, initialDayIndex = 0 }: { days: ScheduleDay[]; people?: PersonSummary[]; adminView?: boolean; initialDayIndex?: number }) {
  // Opens on the current convening day (worked out on the server in Harare time).
  const [activeDayId, setActiveDayId] = useState(days[initialDayIndex]?.id ?? days[0]?.id ?? "");
  const [view, setView] = useState<"schedule" | "docs">("schedule");
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const matchSpeaker = useMemo(() => createSpeakerMatcher(people), [people]);
  
  const activeDayIndex = Math.max(0, days.findIndex(day => day.id === activeDayId));
  const activeDay = days[activeDayIndex];
  const featuredSession = getFeaturedSession(activeDay);
  // The featured session is highlighted at the top but still keeps its place in the timeline.
  const timelineItems = activeDay?.items ?? [];

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="page-container flex flex-col gap-[10px]">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold text-[#0E1726]" style={{ fontFamily: "var(--font-sans)" }}>Programme</h1>
        <p className="text-sm font-semibold text-[#162E55]">Theme: Partnerships for Lasting Change</p>
        <p className="text-xs text-[#6B7590]">Oak Grantee Convening 2026 · Working Agenda</p>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500 bg-slate-50/80 border border-slate-200/60 rounded-xl p-3">
          This agenda is offered as a starting structure for Oak&apos;s content and agenda design; timings and session titles remain fully adjustable to Oak&apos;s program objectives.
        </p>

        {/* Convening Objectives */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[#162E55] uppercase tracking-wider">
            <Target className="w-3.5 h-3.5 text-blue-700" />
            <span>Convening Objectives</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {conveningObjectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="font-bold text-blue-700 shrink-0">{i + 1}.</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Breakout groups */}
        <Link
          href="/breakouts"
          className="group flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 transition hover:border-amber-300 hover:bg-amber-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FBBF24]/25 text-[#92400E]">
            <Shuffle className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[#92400E]">Breakout Groups</span>
            <span className="text-xs text-slate-700">See your group and which breakout session you attend in each round.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#92400E] transition group-hover:translate-x-0.5" />
        </Link>
        {adminView && (
          <Link href="/admin/agenda" className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl bg-[#1C2C4F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#162E55] transition-colors">
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            Edit agenda
          </Link>
        )}
      </header>

      <div className="flex w-full">
        <div 
          aria-label="Programme sections"
          style={{
            display: 'flex',
            maxWidth: '100%',
            height: '40px',
            borderRadius: '12px',
            gap: '4px',
            padding: '4px',
            background: '#E5E8EE'
          }}
        >
          {(["schedule", "docs"] as const).map(tab => (
            <button type="button" key={tab} aria-pressed={view === tab} onClick={() => setView(tab)}
              className={`h-[32px] px-5 flex items-center justify-center rounded-[9px] text-[12px] leading-[16px] font-semibold capitalize transition-all ${view === tab ? "bg-white text-[#0E1726] shadow-[0px_1px_4px_0px_rgba(0,0,0,0.08)]" : "text-[#6B7590] hover:text-slate-800"}`}>
              {tab === "schedule" ? "Schedule" : "Daily Summary"}
            </button>
          ))}
        </div>
      </div>

      {/* Day Selector - Visible on both tabs */}
      <div className={days.length <= 3 ? "grid grid-cols-3 gap-3" : "flex gap-3 overflow-x-auto pb-1"} aria-label="Programme days">
        {days.map((day, i) => {
          const isActive = i === activeDayIndex;
          const { weekday, shortDate } = describeDayDate(day.dateStr);
          return (
          <button key={day.id} type="button" aria-pressed={isActive} onClick={() => setActiveDayId(day.id)}
            className={`rounded-[20px] p-4 text-left transition-all shadow-sm border ${days.length > 3 ? "min-w-[120px] shrink-0" : ""} ${
              isActive 
                ? "bg-[#1C2C4F] border-[#1C2C4F] text-white" 
                : "bg-white border-slate-100 text-[#0E1726] hover:border-slate-300"
            }`}>
            <span className={`block text-[11px] font-bold tracking-widest uppercase mb-1 ${isActive ? 'text-[#93A5CE]' : 'text-[#6B7590]'}`}>
              {weekday || "\u00A0"}
            </span>
            <span className="block text-[18px] md:text-[20px] font-bold" style={{ fontFamily: "var(--font-sans)" }}>
              {day.label}
            </span>
            <span className={`block text-[12px] mt-0.5 ${isActive ? 'text-white/80' : 'text-[#6B7590]'}`}>
              {shortDate}
            </span>
          </button>
          );
        })}
      </div>

      {view === "docs" ? <ProgrammeDocs canManage={adminView} activeDayLabel={`Day ${activeDayIndex + 1}`} dayLabels={days.map((_, i) => `Day ${i + 1}`)} people={people} /> : (
        <div className="space-y-6">
          {/* Featured Session */}
          {featuredSession && (
            <div 
              className="rounded-[24px] text-white relative overflow-hidden w-full"
              style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
                boxShadow: '0px 4px 16px 0px #1C2E5A12, 0px 1px 3px 0px #1C2E5A0D'
              }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
              
              <div className="flex items-center gap-[8px] h-[24px] mb-4 relative z-10"
                   style={{
                     fontFamily: 'var(--font-sans)',
                     fontWeight: 600,
                     fontSize: '10px',
                     lineHeight: '15px',
                     letterSpacing: '1px',
                     textTransform: 'uppercase',
                     color: '#A8BBCE'
                   }}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>FEATURED</span>
                <span style={{ color: '#FFFFFF66' }}>·</span>
                <span style={{ color: '#FFFFFF66', letterSpacing: '0px', textTransform: 'none' }}>
                  {featuredSession.startTime} – {featuredSession.endTime}
                </span>
              </div>
              
              <h2 className="mb-6 pr-8 relative z-10" 
                  style={{ 
                    fontFamily: "var(--font-sans)",
                    fontWeight: 700,
                    fontSize: "20px",
                    lineHeight: "27.5px",
                    letterSpacing: "0px",
                    color: "#FFFFFF"
                  }}>
                {featuredSession.title}
              </h2>
              
              <div className="space-y-3 relative z-10">
                {featuredSession.speakers.length > 0 && (
                  <div className="flex items-start gap-3 text-[13px] text-[#D1D9EB]">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <SpeakerList speakers={featuredSession.speakers} match={matchSpeaker} tone="dark" className="font-medium pt-[3px]" />
                  </div>
                )}
                {featuredSession.location && (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span 
                      style={{ 
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 400, 
                        fontSize: '12px', 
                        lineHeight: '16px', 
                        letterSpacing: '0px', 
                        color: '#A8BBCE73' 
                      }}
                    >
                      {featuredSession.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-[11px] font-medium text-slate-500 pt-2 pb-4">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#1C2C4F]"></div>Plenary</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FBBF24]"></div>Breakout</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#A855F7]"></div>Workshop</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FF8A65]"></div>Social</div>
          </div>

          {/* Timeline List */}
          <div className="space-y-4">
            {timelineItems.map((item, index) => {
              if (item.kind === "break") {
                const startTime = item.data.time.split("–")[0].trim();
                return (
                  <div key={item.data.id} className="flex items-center gap-4 py-3">
                    <div className="w-[45px] text-left text-[11px] font-semibold text-slate-500 shrink-0">
                      {startTime}
                    </div>
                    <div className="flex-1 flex items-center gap-4">
                      <div className="h-[1px] flex-1 bg-slate-200"></div>
                      <span className="text-[11px] font-medium text-slate-400 tracking-wide">
                        {item.data.title}
                      </span>
                      <div className="h-[1px] flex-1 bg-slate-200"></div>
                    </div>
                  </div>
                );
              }

              // Session Card
              const colors = getCategoryColor(item.data.category);
              return (
                <div 
                  key={item.data.id} 
                  className="flex gap-4 bg-white relative w-full"
                  style={{
                    borderRadius: '24px',
                    border: '1px solid #1C2E5A1A',
                    padding: '16px',
                    boxShadow: '0px 4px 16px 0px #1C2E5A12, 0px 1px 3px 0px #1C2E5A0D'
                  }}
                >
                  <div className="w-[45px] text-left shrink-0 flex flex-col items-start pt-1">
                    <span className="text-[12px] font-bold text-[#0E1726]">{item.data.startTime}</span>
                    <span className="text-[11px] font-medium text-slate-400 mt-0.5">-{item.data.endTime}</span>
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 600,
                          fontSize: '14px',
                          lineHeight: '19.25px',
                          letterSpacing: '0px',
                          color: '#0E1726'
                        }}
                      >
                        {item.data.title}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></div>
                          <span className={`text-[10px] font-bold tracking-wide ${colors.text}`}>{item.data.category}</span>
                        </div>
                        {item.data.description && (
                          <button 
                            onClick={() => toggleSession(item.data.id)}
                            className="p-1 -mr-1 rounded-full hover:bg-slate-100 transition-colors"
                            aria-expanded={expandedSessions[item.data.id] ? "true" : "false"}
                            aria-label="Toggle details"
                          >
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedSessions[item.data.id] ? "rotate-180" : ""}`} />
                          </button>
                        )}
                        {!item.data.description && (
                          <div className="p-1 -mr-1">
                            <ChevronDown className="w-4 h-4 text-slate-200 opacity-50" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {item.data.speakers.length > 0 && (
                      <SpeakerList speakers={item.data.speakers} match={matchSpeaker} className="text-[12px] text-slate-500 mt-2" />
                    )}
                    
                    {item.data.location && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2.5">
                        <MapPin className="w-3 h-3" />
                        <span>{item.data.location}</span>
                      </div>
                    )}

                    {item.data.tracks && item.data.tracks.length > 0 && (
                      <div className={`mt-3 grid grid-cols-1 gap-2.5 ${item.data.tracks.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                        {item.data.tracks.map((track, i) => (
                          <div key={`${track.title}-${i}`} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Track {ROMAN[i] ?? i + 1}</p>
                            <h4 className="mt-0.5 text-[13px] font-semibold leading-snug text-[#0E1726]">{track.title}</h4>
                            {track.location && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>{track.location}</span>
                              </div>
                            )}
                            {track.speakers.length > 0 && (
                              <SpeakerList speakers={track.speakers} match={matchSpeaker} className="mt-2 text-[12px] leading-snug text-slate-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {expandedSessions[item.data.id] && item.data.description && (
                      <p className="mt-4 text-[13px] leading-relaxed text-slate-500 border-t border-slate-100 pt-3">
                        {item.data.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="pt-6">
            <a href="/programme/Oak-Grantee-Convening-2026-Agenda.pdf" download="Oak Grantee Convening 2026 - Agenda.pdf" className="inline-flex items-center justify-center w-full md:w-auto gap-2 rounded-xl bg-slate-100 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
              <Download aria-hidden="true" className="h-4 w-4" />
              Download Agenda PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

