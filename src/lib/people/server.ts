import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import type { Person } from "./index";

export const PEOPLE_PHOTO_BUCKET = "people-photos";

/** True when the error means the people migration hasn't been applied yet. */
export function isMissingPeopleTable(error: { code?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** Published profiles in display order. Returns [] if the table isn't set up yet. */
export async function getPublishedPeople(): Promise<Person[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const { data, error } = await createAdminClient()
      .from("people")
      .select("*")
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) {
      if (!isMissingPeopleTable(error)) console.error("People load failed:", error);
      return [];
    }
    return (data ?? []) as Person[];
  } catch (err) {
    console.error("People load failed:", err);
    return [];
  }
}
