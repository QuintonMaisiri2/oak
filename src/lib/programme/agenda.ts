import { z } from "zod";
import type { ProgrammeSession, ScheduleDay } from "@/lib/types/programme";

export const SESSION_CATEGORIES = ["Plenary", "Breakout", "Workshop", "Panel", "Networking", "Social"] as const;

const hhmm = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 09:30.");
const id = z.string().trim().min(1).max(80).regex(/^[\w-]+$/, "Invalid identifier.");
const text = (label: string, max: number) => z.string().trim().min(1, `Enter a ${label}.`).max(max, `Keep the ${label} under ${max} characters.`);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || undefined);

const speakerSchema = z.object({
  name: text("speaker name", 200),
  role: optionalText(200),
  organization: optionalText(200),
  avatarUrl: optionalText(2048),
  initials: optionalText(8),
});

const trackSchema = z.object({
  title: text("track title", 300),
  location: optionalText(200),
  speakers: z.array(speakerSchema).max(30).default([]),
});

const sessionSchema = z.object({
  id,
  dayId: z.string().optional(),
  startTime: hhmm,
  endTime: hhmm,
  title: text("session title", 300),
  description: optionalText(5000),
  speakers: z.array(speakerSchema).max(30).default([]),
  location: z.string().trim().max(200).default(""),
  category: z.enum(SESSION_CATEGORIES),
  isFeatured: z.boolean().optional(),
  tracks: z.array(trackSchema).max(6).optional(),
}).refine(session => session.endTime >= session.startTime, { message: "A session can't end before it starts.", path: ["endTime"] });

const breakSchema = z.object({
  id,
  dayId: z.string().optional(),
  time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d( – ([01]\d|2[0-3]):[0-5]\d)?$/, "Use a time such as 10:00 – 10:30."),
  title: text("break title", 300),
  location: optionalText(200),
  type: z.literal("break").default("break"),
});

const daySchema = z.object({
  id,
  label: text("day label", 60),
  dateStr: text("date", 100),
  theme: optionalText(500),
  items: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("session"), data: sessionSchema }),
    z.object({ kind: z.literal("break"), data: breakSchema }),
  ])).max(100),
});

export const agendaSchema = z.array(daySchema).min(1, "The agenda needs at least one day.").max(14, "The agenda can have at most 14 days.")
  .superRefine((days, ctx) => {
    const seen = new Set<string>();
    for (const day of days) {
      for (const itemId of [day.id, ...day.items.map(item => item.data.id)]) {
        if (seen.has(itemId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate agenda id "${itemId}".` });
        seen.add(itemId);
      }
    }
  })
  // Child items always belong to the day they are listed under.
  .transform(days => days.map(day => ({
    ...day,
    items: day.items.map(item => ({ ...item, data: { ...item.data, dayId: day.id } })),
  })) as ScheduleDay[]);

export const saveAgendaSchema = z.object({
  days: agendaSchema,
  baseUpdatedAt: z.string().max(64).nullable(),
}).strict();

export function getFeaturedSession(day: ScheduleDay | undefined): ProgrammeSession | undefined {
  if (!day) return undefined;
  const featured = day.items.find(item => item.kind === "session" && item.data.isFeatured);
  if (featured && featured.kind === "session") return featured.data;
  const firstSession = day.items.find(item => item.kind === "session");
  return firstSession?.kind === "session" ? firstSession.data : undefined;
}

/** "Monday, 9 November 2026" → { weekday: "MON", shortDate: "9 Nov" }. */
export function describeDayDate(dateStr: string): { weekday: string; shortDate: string } {
  const [weekdayPart = "", rest = ""] = dateStr.split(",").map(part => part.trim());
  const [dayNumber, month] = rest.split(/\s+/);
  return {
    weekday: rest ? weekdayPart.slice(0, 3).toUpperCase() : "",
    shortDate: dayNumber && month ? `${dayNumber} ${month.slice(0, 3)}` : (rest || weekdayPart),
  };
}
