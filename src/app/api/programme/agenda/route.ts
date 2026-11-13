import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/server";
import { isSameOrigin } from "@/lib/auth/policy";
import { saveAgendaSchema } from "@/lib/programme/agenda";
import { getAgenda } from "@/lib/programme/agenda-server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  return NextResponse.json(await getAgenda(), { headers: noStore });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const access = await requireStaff();
  if (access.response) return access.response;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid agenda" }, { status: 400 }); }
  const parsed = saveAgendaSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue.message, path: issue.path }, { status: 400, headers: noStore });
  }

  const { days, baseUpdatedAt } = parsed.data;
  const row = {
    days,
    updated_at: new Date().toISOString(),
    updated_by: access.user.id,
    updated_by_email: access.user.email ?? null,
  };

  // Optimistic concurrency: only overwrite the version the editor started from.
  const query = baseUpdatedAt
    ? access.client.from("programme_agenda").update(row).eq("id", "main").eq("updated_at", baseUpdatedAt)
    : access.client.from("programme_agenda").insert({ id: "main", ...row });
  const { data, error } = await query.select("updated_at,updated_by_email");

  if (error) {
    if (error.code === "23505") return conflict();
    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({ error: "Agenda storage isn't set up yet. Apply the programme_agenda database migration first." }, { status: 503, headers: noStore });
    }
    console.error("Agenda save failed:", error);
    return NextResponse.json({ error: "The agenda could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
  if (!data?.length) return conflict();

  return NextResponse.json({ days, updatedAt: data[0].updated_at, updatedByEmail: data[0].updated_by_email, source: "database" }, { headers: noStore });
}

function conflict() {
  return NextResponse.json(
    { error: "Someone else saved the agenda while you were editing. Reload to see their changes, then reapply yours." },
    { status: 409, headers: noStore },
  );
}
