import { MeetingBookingView } from "@/components/meetings/MeetingBookingView";

export const metadata = {
  title: "Book a Meeting | Oak Foundation Partner Gathering",
  description: "Reserve a 1:1 session during the Oak Foundation partner convening.",
};

export default function BookMeetingPage() {
  return <MeetingBookingView />;
}
