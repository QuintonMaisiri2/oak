import { BreakoutGroups } from "@/components/breakouts/BreakoutGroups";
import { DirectoryAccessGate } from "@/components/directory/DirectoryAccessGate";
import { canAccessDirectory } from "@/lib/auth/directory-access";
import { getBreakoutGroups } from "@/lib/breakouts";

export const dynamic = "force-dynamic";

export default async function BreakoutsPage() {
  // Group lists name individual attendees, so they share the directory's access rules.
  if (!(await canAccessDirectory())) {
    return (
      <DirectoryAccessGate
        title="Breakout Groups"
        description="Breakout group assignments are reserved for registered attendees and convening staff. If you are already registered, sign in with Google to see your group."
        next="/breakouts"
      />
    );
  }
  return <BreakoutGroups data={await getBreakoutGroups()} />;
}
