import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { getIncomingFilesForReview } from '@/lib/drive/service-account';
import { listAuditLogs } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) {
    return auth.response;
  }

  const actorEmail = auth.user?.email || auth.adminUser?.email || 'admin';
  const rate = checkRateLimit(`drive_review_list:${actorEmail}`, 60, 60000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const [reviewData, allLogs] = await Promise.all([
      getIncomingFilesForReview(),
      listAuditLogs(60),
    ]);

    // Filter to the 10 most recent Drive review actions
    const reviewAuditLogs = allLogs
      .filter((l) => l.action.startsWith('drive_file_'))
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      files: reviewData.files,
      count: reviewData.count,
      subfoldersCount: reviewData.subfoldersCount,
      recentAuditLogs: reviewAuditLogs,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/drive/review GET:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to list incoming files for review.',
      },
      { status: 500 }
    );
  }
}
