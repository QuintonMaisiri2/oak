import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { isSameOrigin } from "@/lib/auth/policy";
import { personSchema, slugify } from "@/lib/people";
import { PEOPLE_PHOTO_BUCKET } from "@/lib/people/server";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized access" }, { status: auth.status || 401 });
  return null;
}

/** Removes an uploaded photo from our bucket (ignores external links and failures). */
async function removeStoredPhoto(photoUrl: string | null | undefined) {
  const marker = `/storage/v1/object/public/${PEOPLE_PHOTO_BUCKET}/`;
  if (!photoUrl?.includes(marker)) return;
  const path = decodeURIComponent(photoUrl.split(marker)[1].split("?")[0]);
  await createAdminClient().storage.from(PEOPLE_PHOTO_BUCKET).remove([path]).catch(() => undefined);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid profile" }, { status: 400 }); }
  const parsed = personSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("people").select("photo_url").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const slug = parsed.data.slug || slugify(parsed.data.full_name);
  const { data, error } = await admin
    .from("people")
    .update({ ...parsed.data, slug })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: `A profile with the link "${slug}" already exists` }, { status: 409 });
    console.error("Error updating person:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 400 });
  }
  if (existing.photo_url && existing.photo_url !== data.photo_url) await removeStoredPhoto(existing.photo_url);
  return NextResponse.json({ person: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await params;

  const { data, error } = await createAdminClient().from("people").delete().eq("id", id).select("photo_url").maybeSingle();
  if (error) {
    console.error("Error deleting person:", error);
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 400 });
  }
  await removeStoredPhoto(data?.photo_url);
  return new NextResponse(null, { status: 204 });
}
