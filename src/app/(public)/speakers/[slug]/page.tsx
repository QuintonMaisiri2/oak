import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronLeft, MapPin } from "lucide-react";
import { getAgenda } from "@/lib/programme/agenda-server";
import { getPublishedPeople } from "@/lib/people/server";
import { CATEGORY_LABELS, sessionsForPerson } from "@/lib/people";
import { PersonAvatar } from "@/components/people/PersonAvatar";

export const dynamic = "force-dynamic";

export default async function SpeakerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [people, { days }] = await Promise.all([getPublishedPeople(), getAgenda()]);
  const person = people.find(entry => entry.slug === slug);
  if (!person) notFound();

  const sessions = sessionsForPerson(days, person);

  return (
    <div className="page-container animate-in fade-in zoom-in-95 duration-300">
      <Link href="/speakers" className="mb-5 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#1A2F50] transition-opacity hover:opacity-80">
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.5} /> Speakers
      </Link>

      <div className="flex flex-col gap-4">
        <header className="relative overflow-hidden rounded-[24px] border border-[#162844] bg-[#1A2F50] p-6 text-white shadow-[0_8px_30px_rgb(26,47,80,0.12)] md:p-8">
          <div className="pointer-events-none absolute -right-[15%] top-1/2 h-[280px] w-[280px] -translate-y-1/2 rounded-full bg-white/5" />
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:gap-7">
            <PersonAvatar name={person.full_name} photoUrl={person.photo_url} size="lg" className="border-4 border-white/20" />
            <div className="flex flex-col">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.5px] text-[#A1B0CC]">{CATEGORY_LABELS[person.category]}</p>
              <h1 className="text-[24px] font-bold leading-tight md:text-[28px]" style={{ fontFamily: "var(--font-sans)" }}>{person.full_name}</h1>
              {(person.role || person.organization) && (
                <p className="mt-1.5 text-sm text-[#D1D9EB]">{[person.role, person.organization].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <section className="rounded-[20px] border border-slate-200/90 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#162E55]">About</h2>
            {person.bio ? (
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-600">{person.bio}</p>
            ) : (
              <p className="text-[14px] text-slate-400">A full biography will be added soon.</p>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[20px] border border-slate-200/90 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#162E55]">Sessions</h2>
              {sessions.length === 0 ? (
                <p className="text-[13px] text-slate-400">No sessions listed yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {sessions.map((session, i) => (
                    <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="text-[13px] font-semibold leading-snug text-[#0E1726]">{session.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        {session.dayLabel} · {session.startTime}{session.endTime ? `–${session.endTime}` : ""}
                      </p>
                      {session.location && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {session.location}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/programme" className="mt-4 inline-flex text-[12px] font-bold text-blue-700 hover:underline">View full programme</Link>
            </section>

            {person.advisor_slug && (
              <Link
                href={`/book/${person.advisor_slug}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1C2C4F] px-4 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#162844]"
              >
                Book a 1:1 with {person.full_name.split(" ")[0]} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
