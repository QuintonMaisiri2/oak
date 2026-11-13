"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Shuffle, Users } from "lucide-react";

interface MyGroup {
  name: string;
  memberCount: number;
  sessions: { label: string; time: string; session: string }[];
}

/** Shows the attendee's breakout group and session per round on their pass. Hidden when they aren't in a group. */
export function MyBreakoutCard({ registrationId }: { registrationId: string }) {
  const [group, setGroup] = useState<MyGroup | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/breakouts/mine?id=${encodeURIComponent(registrationId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (mounted && data?.group) setGroup(data.group); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [registrationId]);

  if (!group) return null;
  const letter = group.name.replace(/^group\s+/i, "");

  return (
    <section className="w-full max-w-[608px] overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-2xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#162E55] text-lg font-bold text-white">{letter}</span>
          <div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Shuffle className="h-3 w-3" /> Your breakout group
            </span>
            <h3 className="text-base font-bold text-[#0E1726]">{group.name}</h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
          <Users className="h-3.5 w-3.5" /> {group.memberCount} people
        </span>
      </div>
      <ol className="flex flex-col gap-2 p-5">
        {group.sessions.map(s => (
          <li key={s.label} className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Clock className="h-3.5 w-3.5" /> {s.label}{s.time ? ` · ${s.time}` : ""}
            </span>
            <span className="text-sm font-bold text-[#0E1726]">{s.session || "To be confirmed"}</span>
          </li>
        ))}
      </ol>
      <Link href="/breakouts" className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-bold text-[#162E55] hover:bg-slate-50">
        See everyone in your group <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
