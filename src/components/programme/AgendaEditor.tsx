"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Coffee, ExternalLink, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { agendaSchema, SESSION_CATEGORIES } from "@/lib/programme/agenda";
import type { AgendaSnapshot } from "@/lib/programme/agenda-server";
import type { ScheduleDay, SessionCategory, SessionTrack, TimelineItem } from "@/lib/types/programme";

interface EditorItem {
  id: string;
  kind: "session" | "break";
  start: string;
  end: string;
  title: string;
  description: string;
  category: SessionCategory;
  location: string;
  speakers: string; // one name per line
  tracks: string; // blank-line separated blocks: "Title @ Location", then one presenter per line
  isFeatured: boolean;
}

interface EditorDay {
  id: string;
  label: string;
  dateStr: string;
  theme: string;
  items: EditorItem[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

const tracksToText = (tracks: SessionTrack[] = []) =>
  tracks.map(track => [track.location ? `${track.title} @ ${track.location}` : track.title, ...track.speakers.map(speaker => speaker.name)].join("\n")).join("\n\n");

function textToTracks(value: string): SessionTrack[] {
  return value.split(/\n\s*\n/)
    .map(block => block.split("\n").map(line => line.trim()).filter(Boolean))
    .filter(lines => lines.length > 0)
    .map(([heading, ...names]) => {
      const [title, location] = heading.split(/\s+@\s+/);
      return { title: title.trim(), ...(location?.trim() ? { location: location.trim() } : {}), speakers: names.map(name => ({ name })) };
    });
}

function toEditorItem(item: TimelineItem): EditorItem {
  if (item.kind === "break") {
    const [start = "", end = ""] = item.data.time.split("–").map(part => part.trim());
    return { id: item.data.id, kind: "break", start, end, title: item.data.title, description: "", category: "Plenary", location: item.data.location ?? "", speakers: "", tracks: "", isFeatured: false };
  }
  const session = item.data;
  return {
    id: session.id, kind: "session", start: session.startTime, end: session.endTime, title: session.title,
    description: session.description ?? "", category: session.category, location: session.location,
    speakers: session.speakers.map(speaker => speaker.name).join("\n"), tracks: tracksToText(session.tracks), isFeatured: Boolean(session.isFeatured),
  };
}

function fromEditorItem(item: EditorItem, dayId: string): TimelineItem {
  if (item.kind === "break") {
    return { kind: "break", data: { id: item.id, dayId, time: item.end ? `${item.start} – ${item.end}` : item.start, title: item.title, location: item.location || undefined, type: "break" } };
  }
  return {
    kind: "session",
    data: {
      id: item.id, dayId, startTime: item.start, endTime: item.end, title: item.title,
      description: item.description || undefined, category: item.category, location: item.location,
      speakers: item.speakers.split("\n").map(name => name.trim()).filter(Boolean).map(name => ({ name })),
      ...(item.isFeatured ? { isFeatured: true } : {}),
      ...(item.tracks.trim() ? { tracks: textToTracks(item.tracks) } : {}),
    },
  };
}

const toEditor = (days: ScheduleDay[]): EditorDay[] =>
  days.map(day => ({ id: day.id, label: day.label, dateStr: day.dateStr, theme: day.theme ?? "", items: day.items.map(toEditorItem) }));

const fromEditor = (days: EditorDay[]): ScheduleDay[] =>
  days.map(day => ({ id: day.id, label: day.label, dateStr: day.dateStr, theme: day.theme || undefined, items: day.items.map(item => fromEditorItem(item, day.id)) }));

/** "Monday, 9 November 2026" → "2026-11-09" for <input type="date">. */
function dateStrToIso(dateStr: string): string {
  const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  const month = match ? MONTHS.findIndex(name => name.toLowerCase() === match[2].toLowerCase()) : -1;
  if (!match || month < 0) return "";
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function isoToDateStr(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${day} ${MONTHS[month - 1]} ${year}`;
}

function nextDateStr(dateStr: string): string {
  const iso = dateStrToIso(dateStr);
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return isoToDateStr(date.toISOString().slice(0, 10));
}

function describeIssue(days: EditorDay[], path: (string | number)[], message: string): string {
  const [dayIndex, , itemIndex] = path;
  const day = typeof dayIndex === "number" ? days[dayIndex] : undefined;
  if (!day) return message;
  const item = typeof itemIndex === "number" ? day.items[itemIndex] : undefined;
  const where = item ? `${day.label} · ${item.title || `item ${itemIndex as number + 1}`}` : day.label;
  return `${where}: ${message}`;
}

const inputClass = "mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-[#0E1726] focus:border-[#1C2C4F] focus:outline-none focus:ring-2 focus:ring-[#1C2C4F]/15 disabled:bg-slate-100";
const labelClass = "block text-[12px] font-medium text-slate-600";
const iconButton = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent";

export default function AgendaEditor({ initial }: { initial: AgendaSnapshot }) {
  const [days, setDays] = useState<EditorDay[]>(() => toEditor(initial.days));
  const [baseline, setBaseline] = useState(() => JSON.stringify(fromEditor(toEditor(initial.days))));
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(initial.updatedAt);
  const [lastSavedBy, setLastSavedBy] = useState(initial.updatedByEmail);
  const [activeDayId, setActiveDayId] = useState(initial.days[0]?.id ?? "");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(fromEditor(days)) !== baseline, [days, baseline]);
  const activeIndex = Math.max(0, days.findIndex(day => day.id === activeDayId));
  const activeDay = days[activeIndex];

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(update: (days: EditorDay[]) => EditorDay[]) {
    setSavedMessage(null);
    setDays(update);
  }

  const updateDay = (patch: Partial<EditorDay>) =>
    change(all => all.map((day, i) => (i === activeIndex ? { ...day, ...patch } : day)));

  const updateItems = (update: (items: EditorItem[]) => EditorItem[]) =>
    change(all => all.map((day, i) => (i === activeIndex ? { ...day, items: update(day.items) } : day)));

  function updateItem(itemId: string, patch: Partial<EditorItem>) {
    updateItems(items => items.map(item => {
      if (item.id === itemId) return { ...item, ...patch };
      // Only one featured session per day.
      return patch.isFeatured ? { ...item, isFeatured: false } : item;
    }));
  }

  function addDay() {
    const last = days[days.length - 1];
    const day: EditorDay = { id: newId("day"), label: `Day ${days.length + 1}`, dateStr: last ? nextDateStr(last.dateStr) : "", theme: "", items: [] };
    change(all => [...all, day]);
    setActiveDayId(day.id);
  }

  function removeDay() {
    if (!activeDay || days.length === 1) return;
    if (!window.confirm(`Delete ${activeDay.label} and its ${activeDay.items.length} item(s)? You can still discard before saving.`)) return;
    change(all => all.filter((_, i) => i !== activeIndex));
    setActiveDayId(days[activeIndex === 0 ? 1 : activeIndex - 1].id);
  }

  function moveDay(offset: -1 | 1) {
    const target = activeIndex + offset;
    if (target < 0 || target >= days.length) return;
    change(all => {
      const next = [...all];
      [next[activeIndex], next[target]] = [next[target], next[activeIndex]];
      return next;
    });
  }

  function addItem(kind: EditorItem["kind"]) {
    const previous = activeDay?.items[activeDay.items.length - 1];
    const start = previous ? previous.end || previous.start : "09:00";
    const item: EditorItem = { id: newId("agenda"), kind, start, end: "", title: "", description: "", category: "Plenary", location: "", speakers: "", tracks: "", isFeatured: false };
    updateItems(items => [...items, item]);
    setOpenItemId(item.id);
  }

  function moveItem(index: number, offset: -1 | 1) {
    updateItems(items => {
      const target = index + offset;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const sortByTime = () => updateItems(items => [...items].sort((a, b) => a.start.localeCompare(b.start)));

  function discard() {
    if (!window.confirm("Discard all unsaved changes?")) return;
    const restored = JSON.parse(baseline) as ScheduleDay[];
    setDays(toEditor(restored));
    if (!restored.some(day => day.id === activeDayId)) setActiveDayId(restored[0]?.id ?? "");
    setError(null);
    setConflict(false);
  }

  async function save() {
    setError(null);
    setConflict(false);
    setSavedMessage(null);
    const agenda = fromEditor(days);
    const checked = agendaSchema.safeParse(agenda);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      setError(describeIssue(days, issue.path, issue.message));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/programme/agenda", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: agenda, baseUpdatedAt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        if (response.status === 401 || response.status === 403) {
          setError("Your session has expired or you don't have staff access. Sign in again in another tab, then save.");
        } else {
          setError(result.path ? describeIssue(days, result.path, result.error) : result.error || "The agenda could not be saved.");
        }
        return;
      }
      setBaseline(JSON.stringify(agenda));
      setBaseUpdatedAt(result.updatedAt);
      setLastSavedBy(result.updatedByEmail);
      setSavedMessage("Agenda saved. The programme page and PDF now show these changes.");
    } catch {
      setError("Network error — the agenda was not saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-container pb-32">
      <Link href="/admin/programme" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to programme
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-[#0E1726]" style={{ fontFamily: "var(--font-sans)" }}>Edit agenda</h1>
          <p className="mt-1 text-[13px] text-[#6B7590]">
            {initial.source === "default" && !baseUpdatedAt
              ? "Showing the built-in agenda. Your first save publishes it as the editable version."
              : `Last saved${lastSavedBy ? ` by ${lastSavedBy}` : ""}${baseUpdatedAt ? ` · ${new Date(baseUpdatedAt).toLocaleString()}` : ""}`}
          </p>
        </div>
        <Link href="/programme" target="_blank" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
          View public page <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Day tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Agenda days">
        {days.map((day, i) => (
          <button key={day.id} type="button" role="tab" aria-selected={i === activeIndex} onClick={() => setActiveDayId(day.id)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-left text-sm font-semibold transition ${i === activeIndex ? "border-[#1C2C4F] bg-[#1C2C4F] text-white" : "border-slate-200 bg-white text-[#0E1726] hover:border-slate-300"}`}>
            {day.label || `Day ${i + 1}`}
            <span className={`block text-[11px] font-normal ${i === activeIndex ? "text-white/70" : "text-slate-500"}`}>{day.items.length} item{day.items.length === 1 ? "" : "s"}</span>
          </button>
        ))}
        <button type="button" onClick={addDay} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-white">
          <Plus className="h-4 w-4" /> Add day
        </button>
      </div>

      {activeDay && (
        <>
          {/* Day details */}
          <section className="mb-5 rounded-2xl border border-[#1C2E5A1A] bg-white p-4 shadow-[0_1px_3px_0_#1C2E5A0D]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0E1726]">Day details</h2>
              <div className="flex items-center gap-1">
                <button type="button" className={iconButton} onClick={() => moveDay(-1)} disabled={activeIndex === 0} aria-label="Move day earlier" title="Move day earlier"><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" className={iconButton} onClick={() => moveDay(1)} disabled={activeIndex === days.length - 1} aria-label="Move day later" title="Move day later"><ArrowRight className="h-4 w-4" /></button>
                <button type="button" className={`${iconButton} hover:!bg-red-50 hover:!text-red-600`} onClick={removeDay} disabled={days.length === 1} aria-label="Delete day" title="Delete day"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Label *
                <input className={inputClass} value={activeDay.label} maxLength={60} onChange={e => updateDay({ label: e.target.value })} placeholder="Day 1" />
              </label>
              <label className={labelClass}>Date *
                <input type="date" className={inputClass} value={dateStrToIso(activeDay.dateStr)} onChange={e => updateDay({ dateStr: isoToDateStr(e.target.value) })} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Theme / subtitle
                <input className={inputClass} value={activeDay.theme} maxLength={500} onChange={e => updateDay({ theme: e.target.value })} placeholder="Theme: Partnerships for Lasting Change · …" />
              </label>
            </div>
          </section>

          {/* Items */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0E1726]">Schedule</h2>
            <button type="button" onClick={sortByTime} disabled={activeDay.items.length < 2} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
              <ArrowUpDown className="h-3.5 w-3.5" /> Sort by time
            </button>
          </div>

          {activeDay.items.length === 0 && (
            <p className="mb-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No sessions yet. Add a session or a break below.</p>
          )}

          <ol className="space-y-2.5">
            {activeDay.items.map((item, index) => {
              const open = openItemId === item.id;
              return (
                <li key={item.id} className={`rounded-2xl border bg-white shadow-[0_1px_3px_0_#1C2E5A0D] ${open ? "border-[#1C2C4F]/40" : "border-[#1C2E5A1A]"}`}>
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-[88px] shrink-0 text-[12px] font-semibold text-[#0E1726]">
                      {item.start || "--:--"}{item.end ? ` – ${item.end}` : ""}
                    </div>
                    <button type="button" onClick={() => setOpenItemId(open ? null : item.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#0E1726]">
                        {item.kind === "break" && <Coffee className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        {item.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                        <span className="truncate">{item.title || <em className="font-normal text-slate-400">Untitled</em>}</span>
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {item.kind === "break" ? "Break" : item.category}{item.location ? ` · ${item.location}` : ""}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center">
                      <button type="button" className={iconButton} onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="Move up" title="Move up"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" className={iconButton} onClick={() => moveItem(index, 1)} disabled={index === activeDay.items.length - 1} aria-label="Move down" title="Move down"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" className={iconButton} onClick={() => setOpenItemId(open ? null : item.id)} aria-label={open ? "Close editor" : "Edit"} title={open ? "Close" : "Edit"}>
                        {open ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      </button>
                      <button type="button" className={`${iconButton} hover:!bg-red-50 hover:!text-red-600`} onClick={() => updateItems(items => items.filter(other => other.id !== item.id))} aria-label="Delete" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  {open && (
                    <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                      <div className="sm:col-span-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold" role="radiogroup" aria-label="Item type">
                        {(["session", "break"] as const).map(kind => (
                          <button key={kind} type="button" role="radio" aria-checked={item.kind === kind} onClick={() => updateItem(item.id, { kind, isFeatured: false })}
                            className={`flex-1 rounded-md py-1.5 capitalize ${item.kind === kind ? "bg-white text-[#0E1726] shadow-sm" : "text-slate-500"}`}>{kind}</button>
                        ))}
                      </div>
                      <label className={`${labelClass} sm:col-span-2`}>Title *
                        <input className={inputClass} value={item.title} maxLength={300} autoFocus={!item.title} onChange={e => updateItem(item.id, { title: e.target.value })} />
                      </label>
                      <label className={labelClass}>Start *
                        <input type="time" className={inputClass} value={item.start} onChange={e => updateItem(item.id, { start: e.target.value })} />
                      </label>
                      <label className={labelClass}>End {item.kind === "session" ? "*" : "(optional)"}
                        <input type="time" className={inputClass} value={item.end} onChange={e => updateItem(item.id, { end: e.target.value })} />
                      </label>
                      {item.kind === "session" && (
                        <label className={labelClass}>Category *
                          <select className={inputClass} value={item.category} onChange={e => updateItem(item.id, { category: e.target.value as SessionCategory })}>
                            {SESSION_CATEGORIES.map(category => <option key={category}>{category}</option>)}
                          </select>
                        </label>
                      )}
                      <label className={labelClass}>Location
                        <input className={inputClass} value={item.location} maxLength={200} list="agenda-locations" onChange={e => updateItem(item.id, { location: e.target.value })} placeholder="Main Hall" />
                      </label>
                      {item.kind === "session" && (
                        <>
                          <label className={`${labelClass} sm:col-span-2`}>Speakers / presenters <span className="font-normal text-slate-400">(one per line)</span>
                            <textarea rows={2} className={`${inputClass} h-auto py-2`} value={item.speakers} onChange={e => updateItem(item.id, { speakers: e.target.value })} />
                          </label>
                          <label className={`${labelClass} sm:col-span-2`}>Parallel tracks <span className="font-normal text-slate-400">(optional: one block per track, separated by a blank line. First line &quot;Title @ Room&quot;, then one presenter per line)</span>
                            <textarea rows={item.tracks ? 8 : 2} className={`${inputClass} h-auto py-2 font-mono text-[12px]`} value={item.tracks} onChange={e => updateItem(item.id, { tracks: e.target.value })}
                              placeholder={"Evidence-based impact @ Plenary Room\nSilvia Guizzardi, Oak Foundation\n\nAlternative funding models @ Room TBC\nSimon Teede, Ele Collection"} />
                          </label>
                          <label className={`${labelClass} sm:col-span-2`}>Description
                            <textarea rows={3} maxLength={5000} className={`${inputClass} h-auto py-2`} value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} />
                          </label>
                          <label className="sm:col-span-2 inline-flex items-center gap-2 text-[13px] font-medium text-slate-700">
                            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={item.isFeatured} onChange={e => updateItem(item.id, { isFeatured: e.target.checked })} />
                            Feature this session at the top of the day
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <datalist id="agenda-locations">
            {[...new Set(days.flatMap(day => day.items.map(item => item.location)).filter(Boolean))].map(location => <option key={location} value={location} />)}
          </datalist>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => addItem("session")} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-white">
              <Plus className="h-4 w-4" /> Add session
            </button>
            <button type="button" onClick={() => addItem("break")} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-white">
              <Coffee className="h-4 w-4" /> Add break
            </button>
          </div>
        </>
      )}

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8 lg:bottom-0 lg:left-[256px]">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-[13px]" aria-live="polite">
            {error ? (
              <span className="text-red-600">
                {error}{" "}
                {conflict && <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Reload</button>}
              </span>
            ) : savedMessage ? (
              <span className="text-emerald-700">{savedMessage}</span>
            ) : dirty ? (
              <span className="font-medium text-amber-700">You have unsaved changes.</span>
            ) : (
              <span className="text-slate-500">All changes saved.</span>
            )}
          </div>
          <button type="button" onClick={discard} disabled={!dirty || saving} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            Discard
          </button>
          <button type="button" onClick={save} disabled={!dirty || saving} className="rounded-xl bg-[#1C2C4F] px-5 py-2 text-sm font-semibold text-white hover:bg-[#162E55] disabled:opacity-40">
            {saving ? "Saving…" : "Save agenda"}
          </button>
        </div>
      </div>
    </div>
  );
}
