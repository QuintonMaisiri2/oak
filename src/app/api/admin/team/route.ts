import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUserStatus,
  updateAdminUserRole,
  deleteAdminUser,
  isSharedMailbox,
  getAdminUser,
} from "@/lib/auth/admin-users";
import { isValidAdminEmailDomain, getAllowedAdminDomains } from "@/lib/auth/policy";
import { logAuditEvent } from "@/lib/audit";

// GET: List all admin users (Super Admin only)
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const admins = await listAdminUsers();
    const enriched = admins.map((admin) => ({
      ...admin,
      is_shared_mailbox: isSharedMailbox(admin.email),
    }));

    return NextResponse.json({
      admins: enriched,
      allowedDomains: getAllowedAdminDomains(),
    });
  } catch (error: any) {
    console.error("[GET /api/admin/team error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve administrator list." },
      { status: 500 }
    );
  }
}

// POST: Add new admin user (Super Admin only)
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { full_name, email, role = "admin", team = "Coordination Team" } = body;

    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Strict domain check
    if (!isValidAdminEmailDomain(cleanEmail)) {
      const allowed = getAllowedAdminDomains().join(", ");
      return NextResponse.json(
        { error: `Invalid domain. Admin email must belong strictly to one of: ${allowed}. Lookalike or public domains (e.g. Gmail) are forbidden.` },
        { status: 400 }
      );
    }

    const validRoles = ["admin", "super_admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified." }, { status: 400 });
    }

    const validTeams = ["Coordination Team", "OAK"];
    const cleanTeam = validTeams.includes(team) ? team : "Coordination Team";

    const newAdmin = await createAdminUser({
      email: cleanEmail,
      full_name: full_name.trim(),
      role,
      team: cleanTeam,
    });

    const isShared = isSharedMailbox(cleanEmail);

    await logAuditEvent({
      action: "admin_added",
      actor_email: auth.user.email,
      target_email: cleanEmail,
      details: {
        role,
        team: cleanTeam,
        full_name: full_name.trim(),
        is_shared_mailbox: isShared,
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        ...newAdmin,
        is_shared_mailbox: isShared,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/admin/team error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create administrator." },
      { status: 400 }
    );
  }
}

// PATCH: Update admin role or active status (Super Admin only)
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { email, is_active, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const actorEmail = auth.user.email.toLowerCase().trim();

    const existing = await getAdminUser(cleanEmail);
    if (!existing) {
      return NextResponse.json({ error: `Admin user "${cleanEmail}" not found.` }, { status: 404 });
    }

    let updated = existing;

    // Handle role update
    if (role !== undefined) {
      if (role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ error: "Role must be 'admin' or 'super_admin'." }, { status: 400 });
      }

      if (role !== existing.role) {
        updated = await updateAdminUserRole(cleanEmail, role, actorEmail);
        await logAuditEvent({
          action: "admin_role_changed",
          actor_email: actorEmail,
          target_email: cleanEmail,
          details: {
            old_role: existing.role,
            new_role: role,
            team: updated.team,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Handle active status update
    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return NextResponse.json({ error: "is_active flag must be a boolean." }, { status: 400 });
      }

      if (is_active !== existing.is_active) {
        updated = await updateAdminUserStatus(cleanEmail, is_active, actorEmail);
        await logAuditEvent({
          action: is_active ? "admin_reactivated" : "admin_deactivated",
          actor_email: actorEmail,
          target_email: cleanEmail,
          details: { role: updated.role, team: updated.team },
        });
      }
    }

    return NextResponse.json({ success: true, admin: updated });
  } catch (error: any) {
    console.error("[PATCH /api/admin/team error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update administrator." },
      { status: 400 }
    );
  }
}

// DELETE: Remove admin user (Super Admin only)
export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const actorEmail = auth.user.email.toLowerCase().trim();

    const targetUser = await getAdminUser(cleanEmail);

    await deleteAdminUser(cleanEmail, actorEmail);

    await logAuditEvent({
      action: "admin_removed",
      actor_email: actorEmail,
      target_email: cleanEmail,
      details: { role: targetUser?.role, team: targetUser?.team },
    });

    return NextResponse.json({ success: true, removed: cleanEmail });
  } catch (error: any) {
    console.error("[DELETE /api/admin/team error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove administrator." },
      { status: 400 }
    );
  }
}
