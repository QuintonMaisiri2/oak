import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth/policy";
import { canAccessSharedFiles } from "@/lib/auth/drive-access";
import { createAdminClient } from "@/lib/supabase/server";
import { feedbackSchema } from "@/lib/feedback/schema";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * Saves one anonymous feedback response. Only registered attendees and staff can submit,
 * but nothing that identifies the person is stored: not their name, email or account ID.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!(await canAccessSharedFiles())) {
    return NextResponse.json({ error: "Please sign in to share feedback." }, { status: 401, headers: noStore });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid feedback" }, { status: 400 }); }
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check your answers." }, { status: 400, headers: noStore });
  }

  // Only the answers are written; submitted_on (date only) is set by the database.
  const { error } = await createAdminClient().from("convening_feedback").insert(parsed.data);
  if (error) {
    console.error("Feedback save failed:", error.message);
    return NextResponse.json({ error: "Your feedback could not be saved. Please try again." }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { status: 201, headers: noStore });
}
