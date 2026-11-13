import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";
import { isSameOrigin } from "@/lib/auth/policy";
import { PEOPLE_PHOTO_BUCKET } from "@/lib/people/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Uploads a profile photo and returns its public URL. The profile is saved separately. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized access" }, { status: auth.status || 401 });

  let file: FormDataEntryValue | null = null;
  try { file = (await request.formData()).get("file"); } catch { /* handled below */ }
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo to upload" }, { status: 400 });

  const extension = EXTENSIONS[file.type];
  if (!extension) return NextResponse.json({ error: "Photo must be a JPG, PNG or WebP image" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo must be 5 MB or smaller" }, { status: 400 });

  const storage = createAdminClient().storage;
  const path = `${randomUUID()}.${extension}`;
  const upload = () => storage.from(PEOPLE_PHOTO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });

  let { error } = await upload();
  if (error && /bucket not found/i.test(error.message)) {
    // First upload before the migration created the bucket
    await storage.createBucket(PEOPLE_PHOTO_BUCKET, { public: true });
    ({ error } = await upload());
  }
  if (error) {
    console.error("Profile photo upload failed:", error);
    return NextResponse.json({ error: "Photo upload failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ url: storage.from(PEOPLE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl }, { status: 201 });
}
