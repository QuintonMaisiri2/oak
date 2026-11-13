import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Globe, Mail, ChevronRight, Phone } from "lucide-react";
import { getPartners } from "@/lib/directory/server";
import { getPartnerCategories } from "@/lib/directory/categories";
import { PartnerLogo } from "@/components/directory/PartnerLogo";
import { canAccessDirectory } from "@/lib/auth/directory-access";
import { DirectoryAccessGate } from "@/components/directory/DirectoryAccessGate";

export const dynamic = "force-dynamic";

export default async function PartnerProfilePage({ params }: { params: Promise<{ partnerId: string }> }) {
  const allowed = await canAccessDirectory();
  if (!allowed) {
    return <DirectoryAccessGate />;
  }

  const { partnerId } = await params;
  const partners = await getPartners();
  const partner = partners.find((entry) => entry.id === partnerId);
  if (!partner) notFound();

  const categories = getPartnerCategories(partner);
  const primaryContact = partner.contacts?.[0];

  return (
    <div className="page-container animate-in fade-in zoom-in-95 duration-300">
      <Link href="/directory" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#1A2F50] mb-[20px] hover:opacity-80 transition-opacity font-sans">
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.5} /> Grantee Directory
      </Link>
      
      <div className="flex flex-col gap-[16px]">
        {/* Header Card */}
        <header className="relative overflow-hidden rounded-[24px] bg-[#1A2F50] p-6 md:p-8 text-white shadow-[0_8px_30px_rgb(26,47,80,0.12)] border border-[#162844]">
          {/* Decorative Circle */}
          <div className="pointer-events-none absolute -right-[15%] top-1/2 -translate-y-1/2 h-[280px] w-[280px] rounded-full bg-white/5 mix-blend-overlay"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
            <PartnerLogo partner={partner} size="lg" />
            
            <div className="flex flex-col">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.5px] text-[#A1B0CC] font-sans">
                FOUNDATION · PARTNER SINCE 2018
              </p>
              <h1 className="mb-3.5 text-[24px] md:text-[28px] font-bold leading-tight" style={{ fontFamily: "var(--font-sans)" }}>
                {partner.name}
              </h1>
              
              <div className="flex flex-wrap gap-2 mt-0.5">
                {categories.map(category => (
                  <span key={category} className="rounded-full bg-white/15 border border-white/5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm leading-none font-sans">
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[16px] items-start">
        {/* About Card */}
        <section className="rounded-[24px] border border-slate-100 bg-white p-6 md:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] lg:col-span-2">
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[1.5px] text-[#8F9BA8] font-sans">
            ABOUT
          </h2>
          <p className="max-w-[72ch] text-[14px] leading-[26px] text-[#1E293B] font-sans">
            {partner.description || "More information about this partner will be added soon."}
          </p>
        </section>

        <div className="flex flex-col gap-[16px]">
        {/* Contact Card */}
        {partner.contacts && partner.contacts.length > 0 ? (
          <section className="rounded-[24px] border border-slate-100 bg-white p-6 md:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <h2 className="mb-5 text-[10px] font-bold uppercase tracking-[1.5px] text-[#8F9BA8] font-sans">
              CONTACT{partner.contacts.length > 1 ? "S" : ""} AT CONVENING
            </h2>
            <div className="flex flex-col gap-5 divide-y divide-slate-100">
              {partner.contacts.map((c, i) => {
                const initials = c.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0].toUpperCase())
                  .join("") || "CP";
                return (
                  <div key={c.id || i} className={`flex items-start gap-4 ${i > 0 ? "pt-5" : ""}`}>
                    <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#1A2F50] text-[14px] font-bold text-white shadow-sm font-sans mt-0.5">
                      {initials}
                    </div>
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold text-[#0E1726] font-sans leading-tight">{c.name}</span>
                        {c.role ? (
                          <span className="text-[11px] font-semibold text-[#1A2F50] bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {c.role}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 text-[13px] text-[#6B7590]">
                        <a href={`mailto:${c.email}`} className="hover:text-[#1A2F50] transition-colors font-sans flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="break-all">{c.email}</span>
                        </a>
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="hover:text-[#1A2F50] transition-colors font-sans flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{c.phone}</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-col gap-[12px]">
          {partner.website ? (
            <a href={partner.website} target="_blank" rel="noopener noreferrer"
              className="flex h-[56px] w-full items-center justify-between rounded-[16px] bg-[#1A2F50] px-6 text-[15px] font-bold text-white transition-all hover:bg-[#162844] hover:shadow-md active:scale-[0.98] font-sans group">
              <div className="flex items-center gap-3">
                <Globe className="h-[18px] w-[18px] text-white/80 group-hover:text-white transition-colors" />
                <span>Visit Website</span>
              </div>
              <ExternalLink className="h-[18px] w-[18px] text-white/80 group-hover:text-white transition-colors" />
            </a>
          ) : null}
          
          {primaryContact?.email ? (
            <a href={`mailto:${primaryContact.email}`}
              className="flex h-[56px] w-full items-center justify-between rounded-[16px] bg-white border border-slate-100 px-6 text-[15px] font-bold text-[#0E1726] shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-all hover:bg-slate-50 hover:shadow-md active:scale-[0.98] font-sans group">
              <div className="flex items-center gap-3">
                <Mail className="h-[18px] w-[18px] text-[#6B7590] group-hover:text-[#1A2F50] transition-colors" />
                <span>Send Message to {primaryContact.name}</span>
              </div>
              <ChevronRight className="h-[18px] w-[18px] text-[#6B7590] group-hover:text-[#1A2F50] transition-colors" />
            </a>
          ) : (
            <a href="mailto:convening@oakfnd.org?subject=Oak%20Convening%20Inquiry"
              className="flex h-[56px] w-full items-center justify-between rounded-[16px] bg-white border border-slate-100 px-6 text-[15px] font-bold text-[#0E1726] shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-all hover:bg-slate-50 hover:shadow-md active:scale-[0.98] font-sans group">
              <div className="flex items-center gap-3">
                <Mail className="h-[18px] w-[18px] text-[#6B7590] group-hover:text-[#1A2F50] transition-colors" />
                <span>Contact Convening Team</span>
              </div>
              <ChevronRight className="h-[18px] w-[18px] text-[#6B7590] group-hover:text-[#1A2F50] transition-colors" />
            </a>
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}

