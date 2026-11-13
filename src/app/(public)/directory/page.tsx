import { getPartners } from "@/lib/directory/server";
import { PartnerDirectory } from "@/components/directory/PartnerDirectory";
import { canAccessDirectory } from "@/lib/auth/directory-access";
import { DirectoryAccessGate } from "@/components/directory/DirectoryAccessGate";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const allowed = await canAccessDirectory();
  if (!allowed) {
    return <DirectoryAccessGate />;
  }
  return <PartnerDirectory partners={await getPartners()} />;
}
