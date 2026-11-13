"use client";

import { useState } from "react";
import type { Partner } from "@/lib/directory/data";

interface PartnerLogoProps {
  partner: Partner;
  size?: "sm" | "lg";
  className?: string;
  fallbackClassName?: string;
}

export function PartnerLogo({ partner, size = "sm", className = "", fallbackClassName = "" }: PartnerLogoProps) {
  const [error, setError] = useState(false);
  
  let hostname = "";
  try { if (partner.website) hostname = new URL(partner.website).hostname; } catch {}

  const isOSF = partner.name.toLowerCase().includes("open society");
  let initials = isOSF ? "OSF" : "PT";
  
  if (!isOSF && partner.name) {
    const parts = partner.name.trim().split(/\s+/);
    if (parts.length === 1) {
      initials = parts[0].substring(0, 3).toUpperCase();
    } else {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
  }

  if (partner.logo || (hostname && !error)) {
    const defaultClasses = size === "sm" 
      ? "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm"
      : "flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-white border border-slate-100 shadow-sm";
      
    const imgSrc = partner.logo || `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${hostname}&size=128`;

    return (
      <div className={`${defaultClasses} ${className}`}>
        <img 
          src={imgSrc} 
          alt={`${partner.name} logo`}
          className={`h-full w-full object-contain ${size === 'sm' ? 'p-1.5' : 'p-2'}`}
          onError={() => setError(true)}
        />
      </div>
    );
  }

  const defaultFallbackClasses = size === "sm"
    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#162E55] text-sm font-bold text-white"
    : "flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[16px] bg-white/10 text-[18px] font-extrabold tracking-wider border border-white/10 shadow-inner text-white font-sans";

  return (
    <div aria-hidden="true" className={`${defaultFallbackClasses} ${fallbackClassName}`}>
      {initials}
    </div>
  );
}
