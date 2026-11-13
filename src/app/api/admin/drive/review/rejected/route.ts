import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server';
import { getRejectedFilesForReview } from '@/lib/drive/service-account';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Enforce Super Admin only
  const auth = await requireSuperAdmin();
  if (auth.response) {
    return auth.response;
  }

  const actorEmail = auth.user?.email || auth.adminUser?.email || 'super_admin';
  const rate = checkRateLimit(`drive_rejected_list:${actorEmail}`, 60, 60000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const files = await getRejectedFilesForReview();
    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/drive/review/rejected GET:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to list rejected files.',
      },
      { status: 500 }
    );
  }
}
