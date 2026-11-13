"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionStatus } from "@/lib/session";
import RegisterPage from "./register/page";

export default function RootPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSessionStatus()
      .then(({ isStaff, partnerId, isRegistered }) => {
        if (!mounted) return;
        if (isStaff) {
          router.replace("/admin");
        } else if (partnerId) {
          router.replace(`/pass/${partnerId}`);
        } else if (isRegistered) {
          router.replace("/book");
        } else {
          setIsChecking(false);
        }
      })
      .catch(() => {
        if (mounted) setIsChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  if (isChecking) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary"></div>
      </div>
    );
  }

  return <RegisterPage />;
}
