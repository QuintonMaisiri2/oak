import { MeetingBookingView } from "@/components/meetings/MeetingBookingView";

export default async function BookAdvisorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MeetingBookingView initialAdvisorSlug={slug} />;
}
