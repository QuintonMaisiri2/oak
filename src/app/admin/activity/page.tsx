import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { listAuditLogs } from "@/lib/audit";
import { ActivityClientView } from "./ActivityClientView";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const auth = await requireSuperAdmin();
  if (auth.response) {
    redirect("/admin");
  }

  const logs = await listAuditLogs(150);

  return (
    <div className="page-container space-y-6">
      <ActivityClientView
        initialLogs={logs}
        currentSuperAdminEmail={auth.user.email}
      />
    </div>
  );
}
