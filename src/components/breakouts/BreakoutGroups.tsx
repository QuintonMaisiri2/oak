"use client";

import { useMemo, useState } from "react";
import { Clock, Search, Users, X } from "lucide-react";
import type { BreakoutData, BreakoutGroup } from "@/lib/breakouts";

const GROUP_STYLES = [
  { badge: "bg-[#162E55] text-white", ring: "ring-[#162E55]/30", soft: "bg-[#162E55]/5" },
  { badge: "bg-[#B45309] text-white", ring: "ring-[#B45309]/30", soft: "bg-[#B45309]/5" },
  { badge: "bg-[#047857] text-white", ring: "ring-[#047857]/30", soft: "bg-[#047857]/5" },
  { badge: "bg-[#7C3AED] text-white", ring: "ring-[#7C3AED]/30", soft: "bg-[#7C3AED]/5" },
];

const styleFor = (index: number) => GROUP_STYLES[index % GROUP_STYLES.length];
const shortName = (group: string) => group.replace(/^group\s+/i, "");

function matches(group: BreakoutGroup, q: string) {
  return group.members.filter(m => m.name.toLowerCase().includes(q) || m.organisation.toLowerCase().includes(q));
}

export function BreakoutGroups({ data }: { data: BreakoutData }) {
  const { rounds, groups } = data;
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("");
  const q = query.trim().toLowerCase();

  const results = useMemo(
    () => (q ? groups.flatMap(group => matches(group, q).map(member => ({ group, member }))) : []),
    [groups, q],
  );

  const visibleGroups = groups.filter(g => !activeGroup || g.name === activeGroup);
  // A single selected group spans the full width, so lay its names out in columns.
  const single = visibleGroups.length === 1;
  const total = groups.reduce((sum, g) => sum + g.members.length, 0);

  return (
    <div className="page-container flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold text-[#0E1726]" style={{ fontFamily: "var(--font-sans)" }}>Breakout Groups</h1>
        <p className="text-sm text-[#6B7590]">
          {total} grantees across {groups.length} groups. Each group rotates through the breakout sessions, one topic per round.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Breakout groups will appear here soon.</p>
      ) : (
        <>
          {/* Rounds schedule */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#162E55]">Rounds</h2>
            <div className={`grid gap-4 ${rounds.length > 1 ? "md:grid-cols-2" : ""} ${rounds.length > 2 ? "xl:grid-cols-3" : ""}`}>
              {rounds.map((round, r) => (
                <div key={round.label} className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-[#0E1726]">{round.label}</h3>
                    {round.time && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <Clock className="h-3.5 w-3.5" /> {round.time}
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {groups.map((group, g) => (
                      <li key={group.name} className={`flex items-center gap-3 rounded-xl p-2.5 ${styleFor(g).soft}`}>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${styleFor(g).badge}`}>
                          {shortName(group.name)}
                        </span>
                        <span className="text-sm font-semibold text-[#0E1726]">{group.sessions[r] || "To be confirmed"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Find your group */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#162E55]">Find your group</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by your name or organisation"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm outline-none focus:border-[#162E55] focus:ring-2 focus:ring-[#162E55]/15"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {q && (
              results.length === 0 ? (
                <p className="text-sm text-slate-500">No one matches “{query.trim()}”. Check the spelling, or ask the registration desk.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {results.slice(0, 12).map(({ group, member }) => {
                    const g = groups.indexOf(group);
                    return (
                      <li key={`${group.name}-${member.name}`} className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${styleFor(g).badge}`}>{shortName(group.name)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0E1726]">{member.name}</p>
                            <p className="text-xs text-slate-500">{member.organisation} · {group.name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-slate-600 sm:text-right">
                          {rounds.map((round, r) => (
                            <span key={round.label}>
                              <span className="font-semibold text-slate-800">{round.label}{round.time ? ` (${round.time})` : ""}:</span> {group.sessions[r] || "TBC"}
                            </span>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                  {results.length > 12 && <li className="text-xs text-slate-500">{results.length - 12} more matches. Narrow your search to see them.</li>}
                </ul>
              )
            )}
          </section>

          {/* Group rosters */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#162E55]">Groups</h2>
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter groups">
                {["", ...groups.map(g => g.name)].map(name => (
                  <button
                    key={name || "all"}
                    type="button"
                    role="tab"
                    aria-selected={activeGroup === name}
                    onClick={() => setActiveGroup(name)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeGroup === name ? "bg-[#162E55] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {name || "All"}
                  </button>
                ))}
              </div>
            </div>
            <div className={`grid gap-4 ${visibleGroups.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
              {visibleGroups.map(group => {
                const g = groups.indexOf(group);
                const hits = q ? new Set(matches(group, q)) : null;
                return (
                  <article key={group.name} className={`flex flex-col rounded-[20px] border border-slate-200/90 bg-white shadow-sm ring-1 ${styleFor(g).ring}`}>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${styleFor(g).badge}`}>{shortName(group.name)}</span>
                        <h3 className="text-base font-bold text-[#0E1726]">{group.name}</h3>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Users className="h-3.5 w-3.5" /> {group.members.length}
                      </span>
                    </div>
                    <ol className="flex flex-col gap-1.5 border-b border-slate-100 px-5 py-4">
                      {rounds.map((round, r) => (
                        <li key={round.label} className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="shrink-0 font-semibold text-slate-500">{round.label}{round.time ? ` · ${round.time}` : ""}</span>
                          <span className="text-right font-semibold text-[#0E1726]">{group.sessions[r] || "TBC"}</span>
                        </li>
                      ))}
                    </ol>
                    <ul className={single
                      ? "grid grid-cols-1 gap-x-6 px-5 py-2 sm:grid-cols-2 lg:grid-cols-3 [&>li]:border-b [&>li]:border-slate-100"
                      : "flex flex-col divide-y divide-slate-100 px-5 py-2"}>
                      {group.members.map(member => (
                        <li key={member.name + member.organisation} className={`flex flex-col py-2 ${hits?.has(member) ? "-mx-2 rounded-lg bg-amber-50 px-2" : ""}`}>
                          <span className="text-sm font-semibold text-[#0E1726]">{member.name}</span>
                          {member.organisation && <span className="text-xs text-slate-500">{member.organisation}</span>}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
