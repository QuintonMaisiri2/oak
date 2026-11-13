import { canAccessSharedFiles } from "@/lib/auth/drive-access";
import { SharedFilesAccessGate } from "@/components/drive/SharedFilesAccessGate";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Convening Feedback | Oak Foundation Grantee Convening",
  description: "Share anonymous feedback on the Oak Grantee Convening 2026.",
};

export default async function FeedbackPage() {
  if (!(await canAccessSharedFiles())) {
    return (
      <SharedFilesAccessGate
        title="Convening Feedback"
        description="The feedback form is for registered attendees. Sign in or open your digital pass to continue. Your answers stay anonymous."
        next="/feedback"
      />
    );
  }
  return <FeedbackForm />;
}
