import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { clearDriveCache, getPublishedDriveFiles } from '@/lib/drive/client';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) {
      return auth.response;
    }

    // Invalidate in-memory and revalidate
    clearDriveCache();
    const freshData = await getPublishedDriveFiles(true);

    // Audit log
    await logAuditEvent({
      action: 'drive_cache_refreshed',
      actor_email: auth.user?.email || auth.adminUser?.email,
      details: {
        file_count: freshData.files.length,
        categories: freshData.categories.map((c) => `${c.name}: ${c.count}`),
        refreshed_at: freshData.lastUpdated,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Drive cache refreshed successfully.',
      data: freshData,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/drive/refresh:', err);
    return NextResponse.json({ error: 'Failed to refresh Drive cache.' }, { status: 500 });
  }
}
