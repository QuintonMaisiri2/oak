import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/server';
import { getPublishedDriveFiles, getDriveConfig } from '@/lib/drive/client';
import { checkDriveWriteHealth, getIncomingFilesForReview } from '@/lib/drive/service-account';
import { AdminDriveView } from '@/components/admin/AdminDriveView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Google Drive Management | Admin | Oak Foundation',
};

export default async function AdminDrivePage() {
  const access = await requireAdmin();
  if (access.response) {
    redirect('/admin/login?next=/admin/drive');
  }

  const isSuperAdmin = access.adminUser?.role === 'super_admin';

  const config = getDriveConfig();
  const [driveResult, healthResult, incomingResult] = await Promise.all([
    getPublishedDriveFiles(),
    checkDriveWriteHealth().catch(() => ({ ok: false, isConfigured: false })),
    getIncomingFilesForReview().catch(() => ({ files: [], count: 0 })),
  ]);

  return (
    <div className="page-container space-y-6">
      <AdminDriveView
        initialFiles={driveResult.files}
        initialCategories={driveResult.categories}
        configured={driveResult.configured}
        publishedFolderId={driveResult.publishedFolderId}
        incomingFolderId={driveResult.incomingFolderId}
        incomingFiles={driveResult.incomingFiles || []}
        uploadFormUrl={config.uploadFormUrl}
        lastUpdated={driveResult.lastUpdated}
        initialError={driveResult.error}
        missingVars={driveResult.configured ? [] : (driveResult.missingVars || config.missingVars || [])}
        isSuperAdmin={isSuperAdmin}
        healthStatus={healthResult}
        pendingCount={incomingResult.count}
      />
    </div>
  );
}
