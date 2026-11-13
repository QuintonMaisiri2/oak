import { NextResponse } from "next/server";
import { getPartners } from "@/lib/directory/server";
import { getPartnerCategories } from "@/lib/directory/categories";

export const dynamic = "force-dynamic";

export async function GET() {
  const partners = await getPartners();
  return NextResponse.json(
    partners.map(p => ({ 
      name: p.name, 
      categories: getPartnerCategories(p) 
    })).sort((a, b) => a.name.localeCompare(b.name))
  );
}
