import ProgrammePage from "@/components/programme/ProgrammePage";
import { getAgenda } from "@/lib/programme/agenda-server";
import { getCurrentProgrammeDayIndex } from "@/lib/event-days";
import { getPublishedPeople } from "@/lib/people/server";
import { canAccessSharedFiles } from "@/lib/auth/drive-access";
import { SharedFilesAccessGate } from "@/components/drive/SharedFilesAccessGate";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await canAccessSharedFiles())) {
    return (
      <SharedFilesAccessGate
        title="Convening Programme"
        description="The programme, session notes and photos are for registered attendees and convening staff. Sign in or open your digital pass to continue."
        next="/programme"
      />
    );
  }

  const [{ days }, people] = await Promise.all([getAgenda(), getPublishedPeople()]);
  const speakers = people.map(({ slug, full_name, role, organization, photo_url, aliases }) => ({ slug, full_name, role, organization, photo_url, aliases }));
  return <ProgrammePage days={days} people={speakers} initialDayIndex={getCurrentProgrammeDayIndex(days.length)} />;
}
