import { z } from "zod";

export const noteSchema = z.object({
  author_org: z.string().trim().min(1, "Enter your organisation.").max(200, "Keep the organisation under 200 characters."),
  photo_urls: z.array(z.string().trim().max(2048).url("Enter a valid picture URL.").refine(value => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch { return false; }
  }, "Use an HTTPS picture URL without login credentials.")).max(1, "Attach one picture per note.").default([]),
  day: z.string().regex(/^Day ([1-9]|1[0-4])$/, "Choose an event day."),
  notes: z.string().trim().min(1, "Write a note first.").max(5000, "Keep notes under 5,000 characters."),
}).strict();

export type CreateNoteInput = z.infer<typeof noteSchema>;

export interface DocumentationPost {
  id: string;
  user_id?: string | null;
  day: string;
  notes: string;
  photo_urls: string[] | null;
  author_name: string | null;
  author_initials: string | null;
  author_org: string | null;
  created_at: string;
}
