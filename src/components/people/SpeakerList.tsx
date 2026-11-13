import Link from "next/link";
import type { Speaker } from "@/lib/types/programme";
import type { PersonSummary } from "@/lib/people";
import { PersonAvatar } from "./PersonAvatar";

/**
 * Agenda speakers, one per line. Speakers with a profile get their photo and link to it;
 * everyone else (groups, organisations) stays plain text.
 */
export function SpeakerList({ speakers, match, tone = "light", className = "" }: {
  speakers: Speaker[];
  match: (agendaName: string) => PersonSummary | null;
  tone?: "light" | "dark";
  className?: string;
}) {
  const linkClass = tone === "dark" ? "hover:text-white" : "hover:text-[#1C2C4F]";
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {speakers.map((speaker, i) => {
        const person = match(speaker.name);
        if (!person) return <li key={`${speaker.name}-${i}`}>{speaker.name}</li>;
        return (
          <li key={`${speaker.name}-${i}`}>
            <Link href={`/speakers/${person.slug}`} className={`inline-flex items-center gap-2 underline-offset-2 hover:underline ${linkClass}`}>
              <PersonAvatar name={person.full_name} photoUrl={person.photo_url} size="xs" />
              <span>{speaker.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
