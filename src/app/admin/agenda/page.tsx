import AgendaEditor from "@/components/programme/AgendaEditor";
import { getAgenda } from "@/lib/programme/agenda-server";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <AgendaEditor initial={await getAgenda()} />;
}
