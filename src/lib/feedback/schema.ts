import { z } from "zod";

/**
 * Convening feedback form (mirrors the printed "Convening feedback" form).
 * Anonymous by design: no name, email, organisation or account ID is collected or stored.
 */

export interface RatingItem { key: string; label: string; day?: string }

export const OBJECTIVES: RatingItem[] = [
  { key: "relationships", label: "Strengthened relationships among grantees and Oak" },
  { key: "collaboration", label: "Opened up opportunities for practical collaboration beyond the convening" },
  { key: "understanding", label: "Deepened my understanding of Oak's history, approach and key guidelines" },
  { key: "funding_ideas", label: "Gave me practical ideas on resource mobilisation and alternative funding models" },
];

export const SESSIONS: RatingItem[] = [
  { key: "welcome", day: "Day 1", label: "Welcome, introduction to Oak & the Oak Zimbabwe Programme" },
  { key: "showcases", day: "Day 1–2", label: "Grantee showcases" },
  { key: "speed_networking", day: "Day 1", label: "Speed networking among grantees" },
  { key: "keynote_panel", day: "Day 2", label: "Keynote panel: Beyond Funding, Building Resilient Partnerships" },
  { key: "mel", day: "Day 2", label: "Monitoring, Evaluation & Learning" },
  { key: "od", day: "Day 2", label: "Organisational Development" },
  { key: "breakouts", day: "Day 2", label: "Breakout sessions (rounds 1 & 2) and plenary review" },
  { key: "communications", day: "Day 3", label: "Oak Communications" },
  { key: "safeguarding", day: "Day 3", label: "Safeguarding" },
  { key: "reflections", day: "Day 3", label: "Reflections & way forward" },
];

export const ARRANGEMENTS: RatingItem[] = [
  { key: "venue", label: "Venue and facilities" },
  { key: "catering", label: "Catering" },
  { key: "pre_info", label: "Information and communication before the convening" },
  { key: "registration", label: "Registration and on-site support" },
  { key: "travel", label: "Travel and accommodation arrangements (if provided)" },
];

export const TRACKS = [
  { key: "evidence", label: "Evidence-based impact" },
  { key: "alt_funding", label: "Alternative funding models" },
  { key: "resource_mobilisation", label: "Resource mobilisation" },
] as const;

export const QUESTIONS = [
  { key: "experience", label: "How was the convening for you?" },
  { key: "improvements", label: "What could have been improved? Content, format, timing or logistics?" },
  { key: "most_valuable", label: "What was most valuable, and what will you take back to your organisation?" },
] as const;

const rating = z.number().int().min(1).max(5);

/** A group of 1–5 ratings keyed by item; items left blank are simply omitted. */
function ratingGroup(items: RatingItem[]) {
  const allowed = new Set(items.map(item => item.key));
  return z.record(z.string(), rating)
    .refine(value => Object.keys(value).every(key => allowed.has(key)), "Unknown item")
    .default({});
}

const comment = z.string().trim().max(3000, "Keep each answer under 3,000 characters.").optional().transform(value => value || null);

export const feedbackSchema = z.object({
  overall: rating,
  objectives: ratingGroup(OBJECTIVES),
  sessions: ratingGroup(SESSIONS),
  arrangements: ratingGroup(ARRANGEMENTS),
  tracks: z.array(z.enum(TRACKS.map(track => track.key) as [string, ...string[]])).max(TRACKS.length).default([]),
  experience: comment,
  improvements: comment,
  most_valuable: comment,
}).strict();

export type FeedbackInput = z.input<typeof feedbackSchema>;
export type FeedbackRecord = z.output<typeof feedbackSchema>;
