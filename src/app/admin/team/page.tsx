import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { TeamClientView } from "./TeamClientView";
import { listAdminUsers, isSharedMailbox } from "@/lib/auth/admin-users";
import { getAllowedAdminDomains } from "@/lib/auth/policy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team & Permissions | Super Admin | OAK Grantee Convening",
};

export default async function AdminTeamPage() {
  const auth = await requireSuperAdmin();
  if (auth.response) {
    redirect("/admin");
  }

  const admins = await listAdminUsers();
  const enriched = admins.map((a) => ({
    ...a,
    is_shared_mailbox: isSharedMailbox(a.email),
  }));

  return (
    <div className="page-container space-y-6">
      <TeamClientView
        initialAdmins={enriched}
        currentSuperAdminEmail={auth.user.email}
        allowedDomains={getAllowedAdminDomains()}
      />
    </div>
  );
}
