import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth/server';
import { permanentlyDeleteRejectedFile } from '@/lib/drive/service-account';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const deleteSchema = z.object({
  fileId: z.string().min(5).max(120),
});

export async function POST(request: NextRequest) {
  // Enforce Super Admin only
  const auth = await requireSuperAdmin();
  if (auth.response) {
    return auth.response;
  }

  const actorEmail = auth.user?.email || auth.adminUser?.email || 'super_admin';
  const rate = checkRateLimit(`drive_delete:${actorEmail}`, 30, 60000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const parseResult = deleteSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid delete request.', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { fileId } = parseResult.data;

  try {
    await permanentlyDeleteRejectedFile({
      fileId,
      actorEmail,
    });

    return NextResponse.json({
      success: true,
      message: 'File permanently deleted from Rejected folder.',
    });
  } catch (err: any) {
    console.error('Error permanently deleting file:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to delete file.',
      },
      { status: 500 }
    );
  }
}
