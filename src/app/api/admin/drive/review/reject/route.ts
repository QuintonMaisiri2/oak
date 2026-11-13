import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/server';
import { rejectIncomingFile } from '@/lib/drive/service-account';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const singleRejectSchema = z.object({
  fileId: z.string().min(5).max(120),
  reason: z.string().trim().max(500).optional(),
});

const bulkRejectSchema = z.object({
  fileIds: z.array(z.string().min(5).max(120)).min(1).max(50),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) {
    return auth.response;
  }

  const actorEmail = auth.user?.email || auth.adminUser?.email || 'admin';
  const rate = checkRateLimit(`drive_reject:${actorEmail}`, 30, 60000);
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

  // Handle bulk reject
  if (Array.isArray(body?.fileIds)) {
    const parseResult = bulkRejectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid bulk reject request.', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { fileIds, reason } = parseResult.data;
    const results: { fileId: string; success: boolean; error?: string }[] = [];

    for (const fId of fileIds) {
      try {
        await rejectIncomingFile({
          fileId: fId,
          reason,
          actorEmail,
        });
        results.push({ fileId: fId, success: true });
      } catch (err: any) {
        console.error(`[bulk reject error on file ${fId}]:`, err.message);
        results.push({
          fileId: fId,
          success: false,
          error: err.message || 'Failed to move file to Rejected folder.',
        });
      }
    }

    const failedCount = results.filter((r) => !r.success).length;
    const succeededCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      succeededCount,
      failedCount,
      results,
      message:
        failedCount === 0
          ? `Successfully moved ${succeededCount} files to Rejected folder.`
          : `Moved ${succeededCount} files to Rejected. ${failedCount} files failed.`,
    });
  }

  // Handle single reject
  const parseResult = singleRejectSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid rejection request.', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { fileId, reason } = parseResult.data;

  try {
    await rejectIncomingFile({
      fileId,
      reason,
      actorEmail,
    });

    return NextResponse.json({
      success: true,
      message: 'File moved to Rejected folder successfully.',
    });
  } catch (err: any) {
    console.error('Error rejecting file:', err);
    const message = err.message || 'Failed to reject file.';
    const isNotFound = message.includes('not found in the incoming uploads tree');

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
