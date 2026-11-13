"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ChevronRight, LayoutList, LayoutGrid } from "lucide-react";
import type { Partner } from "@/lib/directory/data";
import { getPartnerCategories } from "@/lib/directory/categories";
import { PartnerLogo } from "./PartnerLogo";

export function PartnerDirectory({ partners }: { partners: Partner[] }) {
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);
  const search = query.trim().toLowerCase();
  const categorized = partners.map((partner) => ({ partner, categories: getPartnerCategories(partner) }));
  const categoryCounts = categorized.flatMap(({ categories }) => categories).reduce((acc, cat) => { acc[cat] = (acc[cat] || 0) + 1; return acc; }, {} as Record<string, number>);
  const categoryOptions = Object.keys(categoryCounts).sort();
  const visible = categorized.filter(({ partner, categories }) =>
    (!category || categories.includes(category)) &&
    [partner.name, partner.description].some((value) => value.toLowerCase().includes(search))
  );

  return (
    <div className="page-container">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-[#0E1726]" style={{ fontFamily: "var(--font-sans)" }}>Grantee Directory</h1>
        <p className="mt-1 text-sm text-[#6B7590]">{partners.length} grantee organisations</p>
      </header>
      <div className="mb-6 rounded-[24px] border border-slate-100 bg-white p-5">
        <div className="flex flex-col md:flex-row gap-[20px]">
        <div className="min-w-0 flex-1">
          <label htmlFor="partner-search" className="mb-2 block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px]">SEARCH GRANTEES</label>
          <input id="partner-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search organisations or descriptions..."
            className="w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none" />
        </div>
        <div className="min-w-0 md:w-[320px] shrink-0 relative" ref={dropdownRef}>
          <label className="mb-2 block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px]">FILTER BY CATEGORY</label>
          <button
            type="button"
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none flex justify-between items-center"
          >
            <span className="truncate">{category || `All Categories (${categoryOptions.length})`}</span>
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isCategoryDropdownOpen ? "rotate-90" : ""}`} />
          </button>
          
          {isCategoryDropdownOpen && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
              <button
                type="button"
                className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors ${category === "" ? "font-bold text-[#1A2F50] bg-slate-50" : "text-slate-700"}`}
                onClick={() => { setCategory(""); setIsCategoryDropdownOpen(false); }}
              >
                All Categories ({categoryOptions.length})
              </button>
              {categoryOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors ${category === opt ? "font-bold text-[#1A2F50] bg-slate-50" : "text-slate-700"}`}
                  onClick={() => { setCategory(opt); setIsCategoryDropdownOpen(false); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
        
        </div>
        {(query || category) && (
          <button type="button" onClick={() => { setQuery(""); setCategory(""); }}
            className="mt-4 justify-self-start rounded-lg px-2 py-1 text-sm font-semibold text-[#1A2F50] hover:bg-slate-100 focus-visible:outline-2 transition-colors">
            Clear filters
          </button>
        )}
      </div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[#6B7590]" role="status">
          {visible.length} {visible.length === 1 ? "grantee" : "grantees"} shown
        </p>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === "list"
                ? "bg-white text-[#162E55] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            title="List view"
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === "cards"
                ? "bg-white text-[#162E55] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            title="Cards view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map(({ partner, categories }) => (
            <Link key={partner.id} href={`/directory/${partner.id}`}
              className="block h-full rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-slate-300 group">
              <div className="flex items-start gap-4">
                <PartnerLogo partner={partner} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#0E1726] group-hover:text-[#162E55] transition-colors">{partner.name}</h2>
                    {partner.website && (
                      <span className="shrink-0 text-xs text-[#162E55] font-medium hidden sm:inline">
                        {(() => {
                          try {
                            return new URL(partner.website).hostname.replace(/^www\./, "");
                          } catch {
                            return partner.website;
                          }
                        })()}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {categories.map((label) => <span key={label} className="rounded-full bg-[#F4F6F8] px-2 py-0.5 text-[11px] font-medium text-[#52617A]">{label}</span>)}
                  </div>
                  {partner.description && <p className="mt-2 line-clamp-2 text-sm text-[#6B7590] leading-relaxed">{partner.description}</p>}
                </div>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#162E55] group-hover:translate-x-0.5 transition-all mt-1" />
              </div>
            </Link>
          ))}
          {!visible.length && <p className="col-span-full rounded-3xl bg-white p-6 text-sm text-[#6B7590]">No grantees match your search and category. Try another category or clear the filters.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(({ partner, categories }) => (
            <Link key={partner.id} href={`/directory/${partner.id}`}
              className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md group">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <PartnerLogo partner={partner} />
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#162E55] group-hover:translate-x-0.5 transition-all mt-1" />
                </div>
                <h2 className="text-base font-bold text-[#0E1726] group-hover:text-[#162E55] transition-colors mb-2">{partner.name}</h2>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {categories.map((label) => <span key={label} className="rounded-full bg-[#F4F6F8] px-2 py-0.5 text-[10.5px] font-medium text-[#52617A]">{label}</span>)}
                </div>
                {partner.description && <p className="line-clamp-3 text-xs text-[#6B7590] leading-relaxed mb-3">{partner.description}</p>}
              </div>
              {partner.website && (
                <div className="pt-3 border-t border-slate-100 mt-auto">
                  <span className="text-xs text-[#162E55] font-semibold truncate block">
                    {(() => {
                      try {
                        return new URL(partner.website).hostname.replace(/^www\./, "");
                      } catch {
                        return partner.website;
                      }
                    })()}
                  </span>
                </div>
              )}
            </Link>
          ))}
          {!visible.length && <p className="col-span-full rounded-3xl bg-white p-6 text-sm text-[#6B7590]">No grantees match your search and category. Try another category or clear the filters.</p>}
        </div>
      )}
    </div>
  );
}







