"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Lock } from "lucide-react";
import {
  ARRANGEMENTS, OBJECTIVES, QUESTIONS, SESSIONS, TRACKS,
  type FeedbackInput, type RatingItem,
} from "@/lib/feedback/schema";

const SUBMITTED_KEY = "oak_convening_feedback_2026_submitted";

type Ratings = Record<string, number>;

const STEPS = [
  { title: "The convening", hint: "Overall rating and objectives" },
  { title: "Sessions", hint: "How useful was each session?" },
  { title: "Arrangements", hint: "Venue, catering and logistics" },
  { title: "In your own words", hint: "Three short questions" },
] as const;

/** 1 to 5 buttons that fill their container; tapping the selected number again clears it. */
function RatingScale({ value, onChange, name, size = "md" }: {
  value?: number; onChange: (value?: number) => void; name: string; size?: "md" | "lg";
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map(n => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${n} of 5`}
            onClick={() => onChange(selected ? undefined : n)}
            className={`flex items-center justify-center rounded-xl border font-bold transition ${size === "lg" ? "h-12 text-[16px]" : "h-10 text-[14px]"} ${
              selected
                ? "border-[#162E55] bg-[#162E55] text-white shadow-sm"
                : "border-slate-300 bg-white text-[#162E55] hover:border-[#162E55] hover:bg-[#EEF2F9]"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function RatingCards({ items, values, onChange, numbered = false, columns }: {
  items: RatingItem[]; values: Ratings; onChange: (key: string, value?: number) => void; numbered?: boolean; columns: string;
}) {
  return (
    <ul className={`grid grid-cols-1 gap-3 ${columns}`}>
      {items.map((item, index) => (
        <li
          key={item.key}
          className={`flex flex-col justify-between gap-3 rounded-[16px] border bg-white p-4 transition ${values[item.key] ? "border-[#162E55]/40" : "border-slate-200"}`}
        >
          <p className="flex gap-2.5 text-[14px] leading-snug text-slate-800">
            {numbered && <span className="shrink-0 font-bold text-[#B8862B]">{String(index + 1).padStart(2, "0")}</span>}
            <span>
              {item.day && <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.day}</span>}
              {item.label}
            </span>
          </p>
          <RatingScale name={item.label} value={values[item.key]} onChange={value => onChange(item.key, value)} />
        </li>
      ))}
    </ul>
  );
}

function StepHeading({ title, scale }: { title: string; scale: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-[18px] font-bold text-[#0E1726]">{title}</h2>
      <p className="text-[12px] text-slate-500">{scale}</p>
    </div>
  );
}

export function FeedbackForm() {
  const [step, setStep] = useState(0);
  const [overall, setOverall] = useState<number>();
  const [objectives, setObjectives] = useState<Ratings>({});
  const [sessions, setSessions] = useState<Ratings>({});
  const [arrangements, setArrangements] = useState<Ratings>({});
  const [tracks, setTracks] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSubmitted, setSubmitted] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // Remembers on this device that feedback was already sent (no identity is stored anywhere).
  const submittedBefore = useSyncExternalStore(
    () => () => {},
    () => { try { return Boolean(localStorage.getItem(SUBMITTED_KEY)); } catch { return false; } },
    () => false,
  );
  const submitted = justSubmitted || submittedBefore;

  const update = (setter: React.Dispatch<React.SetStateAction<Ratings>>) => (key: string, value?: number) =>
    setter(current => {
      const next = { ...current };
      if (value === undefined) delete next[key]; else next[key] = value;
      return next;
    });

  // How many items have an answer in each step, for the progress list.
  const answered = [
    (overall ? 1 : 0) + Object.keys(objectives).length,
    Object.keys(sessions).length,
    Object.keys(arrangements).length,
    QUESTIONS.filter(q => answers[q.key]?.trim()).length,
  ];
  const totals = [1 + OBJECTIVES.length, SESSIONS.length, ARRANGEMENTS.length, QUESTIONS.length];

  function goTo(next: number) {
    if (next > 0 && !overall) {
      setStep(0);
      setError("Please rate the convening overall before moving on.");
      return;
    }
    setError("");
    setStep(next);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit() {
    if (saving) return;
    if (!overall) { goTo(0); return; }
    setError("");
    setSaving(true);
    const payload: FeedbackInput = {
      overall, objectives, sessions, arrangements, tracks,
      experience: answers.experience, improvements: answers.improvements, most_valuable: answers.most_valuable,
    };
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your feedback could not be saved. Please try again.");
      try { localStorage.setItem(SUBMITTED_KEY, "1"); } catch { /* storage unavailable */ }
      setSubmitted(true);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your feedback could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const progress = submitted ? 100 : Math.round((step / STEPS.length) * 100);
  const isLast = step === STEPS.length - 1;

  return (
    <div ref={top} className="page-container scroll-mt-4 space-y-5">
      {/* Header band with progress */}
      <header className="overflow-hidden rounded-[22px] bg-[#0E2747] text-white">
        <div className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-end md:justify-between md:px-8">
          <div>
            <h1 className="text-[26px] font-bold leading-tight md:text-[32px]">Convening feedback</h1>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
              Partnerships for Lasting Change <span className="text-[#D9A93F]">•</span> 9–11 November 2026
            </p>
          </div>
          {!submitted && (
            <p className="text-[13px] font-semibold text-white/85">
              Step {step + 1} of {STEPS.length} <span className="text-white/60">· {STEPS[step].title}</span>
            </p>
          )}
        </div>
        <div className="h-1.5 w-full bg-white/10" aria-hidden>
          <div className="h-full bg-[#D9A93F] transition-all duration-500" style={{ width: `${Math.max(progress, 4)}%` }} />
        </div>
      </header>

      {submitted ? (
        <section className="flex flex-col items-center rounded-[22px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <CheckCircle2 aria-hidden className="h-14 w-14 text-[#2F7A57]" />
          <h2 className="mt-4 text-[22px] font-bold text-[#0E1726]">Thank you for your feedback</h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600">
            Your response has been recorded anonymously. It will help Oak and the organising team shape future convenings.
          </p>
          <Link href="/programme" className="mt-6 inline-flex h-11 items-center rounded-full bg-[#162E55] px-6 text-[14px] font-bold text-white hover:bg-[#1C2E5A]">
            Back to the programme
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Step list (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <ol className="space-y-1.5 rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm">
                {STEPS.map((s, i) => {
                  const active = i === step;
                  const done = i < step;
                  return (
                    <li key={s.title}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-current={active ? "step" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-[#EEF2F9]" : "hover:bg-slate-50"}`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                          active ? "bg-[#162E55] text-white" : done ? "bg-[#2F7A57] text-white" : "border border-slate-300 text-slate-500"
                        }`}>
                          {done ? <Check aria-hidden className="h-4 w-4" /> : i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-[14px] font-semibold ${active ? "text-[#0E1726]" : "text-slate-700"}`}>{s.title}</span>
                          <span className="block text-[11px] text-slate-500">{answered[i]} of {totals[i]} answered</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="flex gap-2.5 rounded-[18px] border border-[#D9E2F1] bg-[#F4F7FC] p-4 text-[12px] leading-relaxed text-slate-600">
                <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#425780]" />
                <span><strong className="text-slate-800">Anonymous.</strong> Your name, email and organisation are not recorded with your answers. Please leave them out of your comments too.</span>
              </p>
            </div>
          </aside>

          {/* Current step */}
          <section className="min-w-0 rounded-[22px] border border-slate-200 bg-[#F8FAFC] p-4 md:p-6">
            {step === 0 && (
              <p className="mb-5 flex gap-2.5 rounded-[14px] border border-[#D9E2F1] bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-600 lg:hidden">
                <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#425780]" />
                <span><strong className="text-slate-800">Anonymous.</strong> Your name and organisation are not recorded. Only the overall rating is required; skip anything that doesn&apos;t apply.</span>
              </p>
            )}

            {step === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 rounded-[18px] border border-[#0E2747]/25 bg-white p-5 lg:grid-cols-[1fr_minmax(320px,420px)] lg:items-center">
                  <div>
                    <h2 className="text-[19px] font-bold text-[#0E1726]">Overall, how was the convening? <span className="text-red-700">*</span></h2>
                    <p className="mt-1 text-[12px] text-slate-500">1 poor · 5 excellent</p>
                  </div>
                  <RatingScale name="Overall, how was the convening?" value={overall} onChange={setOverall} size="lg" />
                </div>
                <div>
                  <StepHeading title="How well did the convening meet its objectives?" scale="1 not at all · 5 fully" />
                  <RatingCards items={OBJECTIVES} values={objectives} onChange={update(setObjectives)} numbered columns="md:grid-cols-2" />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <StepHeading title="How useful was each session?" scale="1 not useful · 5 very useful · skip any you missed" />
                  <RatingCards items={SESSIONS} values={sessions} onChange={update(setSessions)} columns="md:grid-cols-2 2xl:grid-cols-3" />
                </div>
                <fieldset>
                  <legend className="mb-3 text-[15px] font-bold text-[#0E1726]">
                    Breakout tracks I joined <span className="font-normal text-slate-500">(tick all, across both rounds)</span>
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {TRACKS.map(track => {
                      const checked = tracks.includes(track.key);
                      return (
                        <label key={track.key} className={`flex cursor-pointer items-center gap-3 rounded-[14px] border bg-white px-4 py-3.5 text-[14px] transition ${checked ? "border-[#162E55] text-[#0E1726]" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => setTracks(current => event.target.checked ? [...current, track.key] : current.filter(key => key !== track.key))}
                            className="h-5 w-5 rounded accent-[#162E55]"
                          />
                          {track.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 2 && (
              <div>
                <StepHeading title="How were the arrangements?" scale="1 poor · 5 excellent · skip any that don't apply" />
                <RatingCards items={ARRANGEMENTS} values={arrangements} onChange={update(setArrangements)} columns="md:grid-cols-2 xl:grid-cols-3" />
              </div>
            )}

            {step === 3 && (
              <div>
                <StepHeading title="The convening, in your own words" scale="All optional" />
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {QUESTIONS.map((question, index) => (
                    <label key={question.key} className="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
                      <span className="flex gap-2.5 text-[14px] font-bold leading-snug text-[#0E1726]">
                        <span className="text-[#B8862B]">{String(index + 1).padStart(2, "0")}</span>
                        {question.label}
                      </span>
                      <textarea
                        rows={6}
                        maxLength={3000}
                        value={answers[question.key] ?? ""}
                        onChange={event => setAnswers(current => ({ ...current, [question.key]: event.target.value }))}
                        className="mt-3 block w-full flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-[14px] leading-relaxed text-slate-800 focus:border-[#162E55] focus:bg-white focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-800">{error}</p>}

            {/* Step navigation */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              {step > 0 ? (
                <button type="button" onClick={() => goTo(step - 1)} className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50">
                  <ArrowLeft aria-hidden className="h-4 w-4" /> Back
                </button>
              ) : <span />}
              <span className="hidden text-[12px] text-slate-500 sm:block">Step {step + 1} of {STEPS.length}</span>
              {isLast ? (
                <button type="button" onClick={submit} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#162E55] px-6 text-[14px] font-bold text-white shadow-sm hover:bg-[#1C2E5A] disabled:opacity-60">
                  {saving ? "Sending…" : "Submit feedback"}
                </button>
              ) : (
                <button type="button" onClick={() => goTo(step + 1)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#162E55] px-6 text-[14px] font-bold text-white shadow-sm hover:bg-[#1C2E5A]">
                  Next <ArrowRight aria-hidden className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
