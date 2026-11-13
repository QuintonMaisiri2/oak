import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { checkDriveWriteHealth } from '@/lib/drive/service-account';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) {
    return auth.response;
  }

  const actorEmail = auth.user?.email || auth.adminUser?.email || 'admin';
  const rate = checkRateLimit(`drive_health:${actorEmail}`, 30, 60000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const health = await checkDriveWriteHealth();
    return NextResponse.json({
      success: true,
      data: health,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/drive/health:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to check Drive write access health',
      },
      { status: 500 }
    );
  }
}
