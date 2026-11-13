import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { isSameOrigin } from "@/lib/auth/policy";
import { personSchema, slugify } from "@/lib/people";
import { getPublishedPeople, isMissingPeopleTable } from "@/lib/people/server";

export const dynamic = "force-dynamic";

const notSetUp = () =>
  NextResponse.json(
    { error: "Profiles aren't set up yet. Run supabase/migrations/20261105_people_profiles.sql in the Supabase SQL editor." },
    { status: 503 }
  );

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("all") !== "true") {
    return NextResponse.json({ people: await getPublishedPeople() });
  }

  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized access" }, { status: auth.status || 401 });

  const { data, error } = await createAdminClient()
    .from("people")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) {
    if (isMissingPeopleTable(error)) return notSetUp();
    console.error("Error loading people:", error);
    return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
  }
  return NextResponse.json({ people: data ?? [] });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized access" }, { status: auth.status || 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid profile" }, { status: 400 }); }
  const parsed = personSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const slug = parsed.data.slug || slugify(parsed.data.full_name);
  if (!slug) return NextResponse.json({ error: "Name must contain letters or numbers" }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("people")
    .insert({ ...parsed.data, slug })
    .select()
    .single();
  if (error) {
    if (isMissingPeopleTable(error)) return notSetUp();
    if (error.code === "23505") return NextResponse.json({ error: `A profile with the link "${slug}" already exists` }, { status: 409 });
    console.error("Error creating person:", error);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 400 });
  }
  return NextResponse.json({ person: data }, { status: 201 });
}
