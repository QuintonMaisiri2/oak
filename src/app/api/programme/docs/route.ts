import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { isSameOrigin } from "@/lib/auth/policy";
import { noteSchema } from "@/lib/programme/documentation";

const fields = "id,day,notes,photo_urls,author_name,author_initials,author_org,created_at";
const noStore = { "Cache-Control": "private, no-store" };

function authorProfile(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const metadataName = user.user_metadata?.full_name;
  const name = (typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : user.email?.split("@")[0] || "User").slice(0, 100);
  const organization = user.user_metadata?.organization;
  return {
    name,
    initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(),
    organization: typeof organization === "string" ? organization.trim().slice(0, 200) : "",
  };
}

export async function GET() {
  const access = await requireUser();
  if (access.response) return access.response;

  const { data, error } = await access.client.from("documentation_posts")
    .select(fields)
    .eq("user_id", access.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Programme documentation load failed:", error);
    return NextResponse.json({ error: "Session notes could not be loaded. Please try again." }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ posts: data ?? [], author: authorProfile(access.user) }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const access = await requireUser();
  if (access.response) return access.response;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid note" }, { status: 400 }); }
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message, errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  const author = authorProfile(access.user);

  const { data, error } = await access.client.from("documentation_posts").insert({
    ...parsed.data,
    user_id: access.user.id,
    author_name: author.name,
    author_initials: author.initials,

  }).select(fields).single();

  if (error) {
    console.error("Programme note save failed:", error);
    return NextResponse.json({ error: "Your note could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ post: data }, { status: 201, headers: noStore });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const access = await requireUser();
  if (access.response) return access.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing note ID" }, { status: 400 });

  const { error } = await access.client.from("documentation_posts")
    .delete()
    .match({ id, user_id: access.user.id });

  if (error) {
    console.error("Programme note deletion failed:", error);
    return NextResponse.json({ error: "Your note could not be deleted. Please try again." }, { status: 503, headers: noStore });
  }

  return new NextResponse(null, { status: 204, headers: noStore });
}
