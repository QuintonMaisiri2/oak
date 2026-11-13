import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/server';
import {
  getIncomingFilesForReview,
  getRejectedFilesForReview,
  checkDriveWriteHealth,
} from '@/lib/drive/service-account';
import { listAuditLogs } from '@/lib/audit';
import { DriveReviewView } from '@/components/admin/DriveReviewView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Review Uploads Queue | Admin | Oak Foundation',
};

export default async function AdminDriveReviewPage() {
  const access = await requireAdmin();
  if (access.response) {
    redirect('/admin/login?next=/admin/drive/review');
  }

  const isSuperAdmin = access.adminUser?.role === 'super_admin';
  const currentUserEmail = access.adminUser?.email || access.user?.email || 'admin';

  // Parallel data loading
  const incomingPromise = getIncomingFilesForReview().catch(() => ({
    files: [],
    count: 0,
    subfoldersCount: 0,
  }));

  const rejectedPromise = isSuperAdmin
    ? getRejectedFilesForReview().catch(() => [])
    : Promise.resolve([]);

  const healthPromise = checkDriveWriteHealth().catch(() => ({
    ok: false,
    isConfigured: false,
    fixMessage: 'Failed to inspect Drive write permissions',
  }));

  const auditLogsPromise = listAuditLogs(60).catch(() => []);

  const [incomingData, rejectedData, healthData, allLogs] = await Promise.all([
    incomingPromise,
    rejectedPromise,
    healthPromise,
    auditLogsPromise,
  ]);

  const recentDriveLogs = allLogs
    .filter((l) => l.action.startsWith('drive_file_'))
    .slice(0, 10);

  return (
    <DriveReviewView
      initialFiles={incomingData.files}
      initialRejectedFiles={rejectedData}
      healthStatus={healthData}
      initialAuditLogs={recentDriveLogs}
      isSuperAdmin={isSuperAdmin}
      currentUserEmail={currentUserEmail}
    />
  );
}
