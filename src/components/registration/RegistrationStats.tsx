"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface MetricsData {
  attendees: number | null;
  sessions: number | null;
  partners: number | null;
}

export function RegistrationStats() {
  const [metrics, setMetrics] = useState<MetricsData>({
    attendees: null,
    sessions: null,
    partners: null,
  });

  useEffect(() => {
    let mounted = true;
    let activeController: AbortController | undefined;

    async function loadMetrics() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch("/api/metrics", { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (mounted && !controller.signal.aborted && data) {
            setMetrics({
              attendees: typeof data.attendees === "number" ? data.attendees : null,
              sessions: typeof data.sessions === "number" ? data.sessions : null,
              partners: typeof data.partners === "number" ? data.partners : null,
            });
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) console.warn("Failed to fetch live event metrics:", err);
      } finally {
        clearTimeout(timeout);
      }
    }

    loadMetrics();

    const handleUpdate = () => {
      loadMetrics();
    };

    window.addEventListener("oak-attendance-update", handleUpdate);
    return () => {
      mounted = false;
      activeController?.abort();
      window.removeEventListener("oak-attendance-update", handleUpdate);
    };
  }, []);

    return (
    <section className="grid grid-cols-2 gap-2 md:gap-3" data-purpose="stats-cards">
      {/* Metric 1: Sessions */}
      <div className="bg-white rounded-[16px] md:rounded-[24px] h-auto md:h-[98px] py-3 px-3 md:p-4 border border-slate-100 shadow-sm flex flex-col items-start justify-center gap-[6px]">
        <Image
          src="/registration/sessions.png"
          alt="Sessions Icon"
          width={20}
          height={20}
          className="object-contain opacity-70 w-4 h-4 md:w-5 md:h-5"
        />
        <div className="text-xl md:text-2xl font-black text-slate-900 leading-none transition-opacity duration-300">
          {metrics.sessions ?? "-"}
        </div>
        <div className="text-[10px] md:text-[12px] font-medium text-slate-400 leading-none text-left">
          Sessions
        </div>
      </div>

      {/* Metric 2: Grantees */}
      <div className="bg-white rounded-[16px] md:rounded-[24px] h-auto md:h-[98px] py-3 px-3 md:p-4 border border-slate-100 shadow-sm flex flex-col items-start justify-center gap-[6px]">
        <Image
          src="/registration/partners.png"
          alt="Grantees Icon"
          width={20}
          height={20}
          className="object-contain opacity-70 w-4 h-4 md:w-5 md:h-5"
        />
        <div className="text-xl md:text-2xl font-black text-slate-900 leading-none transition-opacity duration-300">
          {metrics.partners ?? "-"}
        </div>
        <div className="text-[10px] md:text-[12px] font-medium text-slate-400 leading-none text-left">
          Grantees
        </div>
      </div>
    </section>
  );
}
