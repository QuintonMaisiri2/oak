import ProgrammePage from "@/components/programme/ProgrammePage";
import { getAgenda } from "@/lib/programme/agenda-server";
import { getCurrentProgrammeDayIndex } from "@/lib/event-days";
import { getPublishedPeople } from "@/lib/people/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ days }, people] = await Promise.all([getAgenda(), getPublishedPeople()]);
  const speakers = people.map(({ slug, full_name, role, organization, photo_url, aliases }) => ({ slug, full_name, role, organization, photo_url, aliases }));
  return <ProgrammePage days={days} people={speakers} initialDayIndex={getCurrentProgrammeDayIndex(days.length)} adminView />;
}
