import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMeetingAdminAuth } from "@/lib/auth/admin-meeting-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyMeetingAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    const updateData: any = {};
    if (body.full_name !== undefined) updateData.full_name = body.full_name.trim();
    if (body.job_title !== undefined) updateData.job_title = body.job_title.trim();
    if (body.bio !== undefined) updateData.bio = body.bio.trim();
    if (body.email !== undefined) updateData.email = body.email.trim().toLowerCase();
    if (body.photo_url !== undefined) updateData.photo_url = body.photo_url ? body.photo_url.trim() : null;
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);

    const { data: advisor, error } = await admin
      .from("advisors")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating advisor:", error);
      return NextResponse.json({ error: error.message || "Failed to update advisor" }, { status: 400 });
    }

    return NextResponse.json({ success: true, advisor });
  } catch (err) {
    console.error("Unexpected error in PATCH /api/advisors/[id]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
