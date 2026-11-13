import Link from "next/link";
import { getPublishedPeople } from "@/lib/people/server";
import { CATEGORY_LABELS, initialsOf, type Person } from "@/lib/people";

export const dynamic = "force-dynamic";

function PersonCard({ person }: { person: Person }) {
  return (
    <Link
      href={`/speakers/${person.slug}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-sm transition hover:border-blue-400 hover:shadow-md"
    >
      <div className="aspect-[4/5] w-full overflow-hidden bg-slate-100">
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.full_name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1C2C4F] to-[#3B5A8C] text-4xl font-bold text-white">
            {initialsOf(person.full_name)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">{CATEGORY_LABELS[person.category]}</span>
        <h3 className="text-[15px] font-bold leading-snug text-[#0E1726]">{person.full_name}</h3>
        {(person.role || person.organization) && (
          <p className="text-[12px] leading-snug text-slate-500">{[person.role, person.organization].filter(Boolean).join(" · ")}</p>
        )}
      </div>
    </Link>
  );
}

export default async function SpeakersPage() {
  const people = await getPublishedPeople();
  const featured = people.filter(person => person.is_featured);
  const others = people.filter(person => !person.is_featured);

  return (
    <div className="page-container flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold text-[#0E1726]" style={{ fontFamily: "var(--font-sans)" }}>Speakers</h1>
        <p className="text-sm text-[#6B7590]">The people leading sessions, panels and clinics at the Oak Grantee Convening 2026.</p>
      </header>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Speaker profiles will appear here soon.</p>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#162E55]">Featured</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {featured.map(person => <PersonCard key={person.id} person={person} />)}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section className="flex flex-col gap-3">
              {featured.length > 0 && <h2 className="text-xs font-bold uppercase tracking-wider text-[#162E55]">Speakers &amp; moderators</h2>}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                {others.map(person => <PersonCard key={person.id} person={person} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
