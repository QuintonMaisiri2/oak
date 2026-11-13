import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { EmailTestClientView } from "./EmailTestClientView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email Diagnostics | Super Admin | Oak Foundation",
};

export default async function EmailTestPage() {
  const auth = await requireSuperAdmin();
  if (auth.response) {
    redirect("/admin");
  }

  const currentUserEmail = auth.adminUser?.email || auth.user?.email || "";

  return (
    <div className="page-container space-y-6">
      <EmailTestClientView currentUserEmail={currentUserEmail} />
    </div>
  );
}
