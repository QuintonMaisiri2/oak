import { z } from "zod";
import type { ScheduleDay } from "@/lib/types/programme";

export const PERSON_CATEGORIES = ["speaker", "panelist", "moderator", "oak", "guest"] as const;
export type PersonCategory = (typeof PERSON_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PersonCategory, string> = {
  speaker: "Speaker",
  panelist: "Panelist",
  moderator: "Moderator",
  oak: "Oak Foundation",
  guest: "Guest",
};

export interface Person {
  id: string;
  slug: string;
  full_name: string;
  role: string | null;
  organization: string | null;
  bio: string | null;
  photo_url: string | null;
  category: PersonCategory;
  aliases: string[];
  advisor_slug: string | null;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
}

/** The fields the programme needs to show a speaker's photo and link (keeps page payloads small). */
export type PersonSummary = Pick<Person, "slug" | "full_name" | "role" | "organization" | "photo_url" | "aliases">;

const optional = (max: number) =>
  z.string().trim().max(max).nullish().transform(value => (value ? value : null));

export const personSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug can only use letters, numbers and dashes").max(120).optional(),
  role: optional(200),
  organization: optional(200),
  bio: optional(5000),
  photo_url: optional(2048).refine(value => !value || /^https:\/\//.test(value) || value.startsWith("/"), "Photo must be an https:// link"),
  category: z.enum(PERSON_CATEGORIES).default("speaker"),
  aliases: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  advisor_slug: optional(120),
  is_featured: z.boolean().default(false),
  is_published: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(10000).default(100),
});

export type PersonInput = z.infer<typeof personSchema>;

export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function normalizeName(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** "Silvia Guizzardi, Oak Foundation" / "Karl Riber (Oak)" / "Simon Teede — CSR" -> "silvia guizzardi" */
export function speakerKey(agendaName: string) {
  return normalizeName(agendaName.split(/,|\(|\s[—–-]\s/)[0] ?? agendaName);
}

/** Builds a lookup that turns an agenda speaker line into its profile, if one exists. */
export function createSpeakerMatcher(people: PersonSummary[]) {
  const byKey = new Map<string, PersonSummary>();
  for (const person of people) {
    for (const name of [person.full_name, ...person.aliases]) {
      const key = normalizeName(name);
      if (key && !byKey.has(key)) byKey.set(key, person);
    }
  }
  return (agendaName: string) => byKey.get(speakerKey(agendaName)) ?? null;
}

export interface PersonSession {
  dayLabel: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
}

/** Sessions in the agenda where this person is listed (including breakout tracks). */
export function sessionsForPerson(days: ScheduleDay[], person: PersonSummary): PersonSession[] {
  const match = createSpeakerMatcher([person]);
  const sessions: PersonSession[] = [];
  for (const day of days) {
    for (const item of day.items) {
      if (item.kind !== "session") continue;
      const session = item.data;
      const base = { dayLabel: day.label, dateStr: day.dateStr, startTime: session.startTime, endTime: session.endTime };
      if (session.speakers.some(speaker => match(speaker.name))) {
        sessions.push({ ...base, title: session.title, location: session.location });
      }
      for (const track of session.tracks ?? []) {
        if (track.speakers.some(speaker => match(speaker.name))) {
          sessions.push({ ...base, title: `${session.title}: ${track.title}`, location: track.location ?? session.location });
        }
      }
    }
  }
  return sessions;
}
