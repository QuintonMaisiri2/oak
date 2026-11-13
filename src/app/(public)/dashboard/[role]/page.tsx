"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionStatus } from "@/lib/session";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    getSessionStatus().then(({ isStaff, isSuperAdmin, partnerId }) => {
      if (!mounted) return;
      if (isSuperAdmin) router.replace("/admin?view=superadmin");
      else if (isStaff) router.replace("/admin");
      else if (partnerId) router.replace("/pass/" + partnerId);
      else router.replace("/");
    }).catch(() => { if (mounted) router.replace("/"); });
    return () => { mounted = false; };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#1C2E5A] border-t-transparent"></div>
    </div>
  );
}
