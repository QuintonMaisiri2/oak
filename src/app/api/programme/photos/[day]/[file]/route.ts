import { readFile } from "node:fs/promises";
import path from "node:path";
import { canAccessSharedFiles } from "@/lib/auth/drive-access";

export const dynamic = "force-dynamic";

// Session photos are attendee-only, so they live outside /public and are served after the access check.
const PHOTO_ROOT = path.join(process.cwd(), "private", "programme-photos");

export async function GET(_request: Request, { params }: { params: Promise<{ day: string; file: string }> }) {
  if (!(await canAccessSharedFiles())) {
    return new Response("Sign in to view convening photos.", { status: 401 });
  }

  const { day, file } = await params;
  // Strict names only: no path traversal, JPEG files only.
  if (!/^day[1-9]$/.test(day) || !/^[a-z0-9-]{1,80}\.jpg$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await readFile(path.join(PHOTO_ROOT, day, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
