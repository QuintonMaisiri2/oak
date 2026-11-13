import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ARRANGEMENTS, OBJECTIVES, QUESTIONS, SESSIONS, TRACKS, type RatingItem } from "@/lib/feedback/schema";

export const dynamic = "force-dynamic";

interface FeedbackRow {
  submitted_on: string;
  overall: number;
  objectives: Record<string, number>;
  sessions: Record<string, number>;
  arrangements: Record<string, number>;
  tracks: string[];
  experience: string | null;
  improvements: string | null;
  most_valuable: string | null;
}

function summarise(values: number[]) {
  if (values.length === 0) return { average: null as number | null, count: 0 };
  return { average: values.reduce((sum, v) => sum + v, 0) / values.length, count: values.length };
}

function Bar({ average }: { average: number | null }) {
  const pct = average ? (average / 5) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-[#162E55]" style={{ width: `${pct}%` }} />
    </div>
  );
}

function RatingSummary({ title, items, rows, pick }: {
  title: string; items: RatingItem[]; rows: FeedbackRow[]; pick: (row: FeedbackRow) => Record<string, number>;
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
      <h2 className="bg-[#0E2747] px-5 py-3 text-[15px] font-bold text-white">{title}</h2>
      <ul className="divide-y divide-slate-100">
        {items.map(item => {
          const { average, count } = summarise(rows.map(pick).map(group => group?.[item.key]).filter((v): v is number => typeof v === "number"));
          return (
            <li key={item.key} className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-[1fr_200px] sm:items-center sm:gap-6">
              <p className="text-[13px] text-slate-800">
                {item.day && <span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{item.day}</span>}
                {item.label}
              </p>
              <div className="flex items-center gap-3">
                <Bar average={average} />
                <span className="w-24 shrink-0 text-right text-[13px] font-bold text-[#162E55]">
                  {average === null ? "No ratings" : `${average.toFixed(1)} / 5`}
                  <span className="block text-[11px] font-medium text-slate-400">{count} {count === 1 ? "rating" : "ratings"}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function AdminFeedbackPage() {
  const auth = await requireAdmin();
  if (auth.response) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-[15px] text-slate-600">Only convening staff can view feedback results.</p>
        <Link href="/admin/login?next=/admin/feedback" className="mt-4 inline-block font-bold text-[#162E55] hover:underline">Sign in</Link>
      </div>
    );
  }

  const { data, error } = await createAdminClient()
    .from("convening_feedback")
    .select("submitted_on,overall,objectives,sessions,arrangements,tracks,experience,improvements,most_valuable")
    .order("submitted_on", { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as FeedbackRow[];
  const overall = summarise(rows.map(row => row.overall));
  const distribution = [5, 4, 3, 2, 1].map(score => ({ score, count: rows.filter(row => row.overall === score).length }));

  return (
    <div className="page-container space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#0E1726]">Convening feedback</h1>
          <p className="mt-1 text-[13px] text-slate-500">Anonymous responses from the feedback form at <Link href="/feedback" className="font-semibold text-[#162E55] hover:underline">/feedback</Link>.</p>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-800">
          Feedback could not be loaded. If this is the first time, run the migration supabase/migrations/20261111_convening_feedback.sql in Supabase.
        </p>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] bg-[#0E2747] p-5 text-white">
          <p className="text-[12px] font-bold uppercase tracking-wider text-white/70">Responses</p>
          <p className="mt-2 text-[34px] font-bold leading-none">{rows.length}</p>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Overall rating</p>
          <p className="mt-2 text-[34px] font-bold leading-none text-[#162E55]">{overall.average === null ? "–" : overall.average.toFixed(1)}<span className="text-[16px] text-slate-400"> / 5</span></p>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Overall, by score</p>
          <ul className="mt-2 space-y-1">
            {distribution.map(({ score, count }) => (
              <li key={score} className="flex items-center gap-2 text-[12px] text-slate-600">
                <span className="w-3 font-bold text-[#162E55]">{score}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#B8862B]" style={{ width: rows.length ? `${(count / rows.length) * 100}%` : "0%" }} />
                </div>
                <span className="w-6 text-right">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <RatingSummary title="How well did the convening meet its objectives?" items={OBJECTIVES} rows={rows} pick={row => row.objectives} />
      <RatingSummary title="How useful was each session?" items={SESSIONS} rows={rows} pick={row => row.sessions} />
      <RatingSummary title="How were the arrangements?" items={ARRANGEMENTS} rows={rows} pick={row => row.arrangements} />

      <section className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-bold text-[#0E1726]">Breakout tracks joined</h2>
        <ul className="mt-3 flex flex-wrap gap-3">
          {TRACKS.map(track => (
            <li key={track.key} className="rounded-full bg-[#F4F6FB] px-4 py-2 text-[13px] text-slate-700">
              {track.label}: <strong className="text-[#162E55]">{rows.filter(row => row.tracks?.includes(track.key)).length}</strong>
            </li>
          ))}
        </ul>
      </section>

      {QUESTIONS.map(question => {
        const answers = rows.map(row => row[question.key]).filter((answer): answer is string => Boolean(answer));
        return (
          <section key={question.key} className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-[#0E1726]">{question.label} <span className="font-normal text-slate-400">({answers.length})</span></h2>
            {answers.length === 0 ? (
              <p className="mt-3 text-[13px] text-slate-400">No answers yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {answers.map((answer, i) => (
                  <li key={i} className="whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700">{answer}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
