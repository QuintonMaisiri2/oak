import { getPublishedDriveFiles, getDriveConfig } from '@/lib/drive/client';
import { SharedFilesView } from '@/components/drive/SharedFilesView';
import { SharedFilesAccessGate } from '@/components/drive/SharedFilesAccessGate';
import { canAccessSharedFiles } from '@/lib/auth/drive-access';
import { requireAdmin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shared Files | Oak Foundation Grantee Convening',
  description: 'Access presentations, notes, and approved conference resources for the Oak Foundation convening.',
};

export default async function DrivePage() {
  const allowed = await canAccessSharedFiles();
  if (!allowed) {
    return <SharedFilesAccessGate />;
  }

  const config = getDriveConfig();
  const driveResult = await getPublishedDriveFiles();

  let isSuperAdmin = false;
  try {
    const auth = await requireAdmin();
    isSuperAdmin = !auth.response && auth.adminUser?.role === 'super_admin';
  } catch {
    isSuperAdmin = false;
  }

  return (
    <SharedFilesView
      initialFiles={driveResult.files}
      initialCategories={driveResult.categories}
      configured={driveResult.configured}
      uploadFormUrl={config.uploadFormUrl}
      lastUpdated={driveResult.lastUpdated}
      errorMessage={driveResult.error}
      isSuperAdmin={isSuperAdmin}
      missingVars={driveResult.configured ? [] : (driveResult.missingVars || config.missingVars || [])}
    />
  );
}
