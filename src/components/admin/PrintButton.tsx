'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-[#1C2C4F] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#152240] transition cursor-pointer"
    >
      <Printer className="h-4 w-4" />
      <span>Print All Nametags</span>
    </button>
  );
}
