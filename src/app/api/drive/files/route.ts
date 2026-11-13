import { NextRequest, NextResponse } from 'next/server';
import { getPublishedDriveFiles } from '@/lib/drive/client';
import { canAccessSharedFiles } from '@/lib/auth/drive-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const allowed = await canAccessSharedFiles();
    if (!allowed) {
      return NextResponse.json(
        { error: 'Access restricted. Shared files are only accessible to registered attendees and staff.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    const result = await getPublishedDriveFiles(refresh);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: any) {
    console.error('Error in /api/drive/files:', err);
    return NextResponse.json(
      {
        configured: false,
        files: [],
        categories: [],
        lastUpdated: new Date().toISOString(),
        error: 'Failed to retrieve shared files.',
      },
      { status: 500 }
    );
  }
}
