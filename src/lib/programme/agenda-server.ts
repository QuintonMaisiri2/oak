import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { scheduleDays as defaultScheduleDays } from "@/components/programme/data";
import { agendaSchema } from "@/lib/programme/agenda";
import type { ScheduleDay } from "@/lib/types/programme";

export interface AgendaSnapshot {
  days: ScheduleDay[];
  updatedAt: string | null;
  updatedByEmail: string | null;
  source: "database" | "default";
}

const defaultAgenda: AgendaSnapshot = { days: defaultScheduleDays, updatedAt: null, updatedByEmail: null, source: "default" };

/** Reads the published agenda with the public (anon) key; falls back to the built-in agenda. */
export async function getAgenda(): Promise<AgendaSnapshot> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || url.includes("your-project")) return defaultAgenda;

  try {
    const client = createSupabaseClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.from("programme_agenda")
      .select("days,updated_at,updated_by_email")
      .eq("id", "main")
      .maybeSingle();
    if (error) {
      // 42P01 / PGRST205: table not created yet — the migration hasn't been applied.
      if (error.code !== "42P01" && error.code !== "PGRST205") console.error("Agenda load failed:", error);
      return defaultAgenda;
    }
    if (!data) return defaultAgenda;
    const parsed = agendaSchema.safeParse(data.days);
    if (!parsed.success) {
      console.error("Stored agenda is invalid, using built-in agenda:", parsed.error.issues[0]);
      return defaultAgenda;
    }
    return { days: parsed.data, updatedAt: data.updated_at, updatedByEmail: data.updated_by_email, source: "database" };
  } catch (err) {
    console.error("Agenda load failed:", err);
    return defaultAgenda;
  }
}
