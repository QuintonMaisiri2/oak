import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { listAuditLogs } from "@/lib/audit";

// GET: List audit logs (Super Admin only)
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const logs = await listAuditLogs(150);
    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("[GET /api/admin/activity error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve audit activity logs." },
      { status: 500 }
    );
  }
}
