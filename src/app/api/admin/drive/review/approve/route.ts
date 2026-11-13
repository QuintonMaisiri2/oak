import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/server';
import { approveIncomingFile } from '@/lib/drive/service-account';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const categoryEnum = z.enum(['Presentations', 'Notes', 'Images', 'Other']);

const singleApproveSchema = z.object({
  fileId: z.string().min(5).max(120),
  category: categoryEnum,
  newName: z.string().trim().max(250).optional(),
  description: z.string().trim().max(1000).optional(),
});

const bulkApproveSchema = z.object({
  fileIds: z.array(z.string().min(5).max(120)).min(1).max(50),
  category: categoryEnum,
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) {
    return auth.response;
  }

  const actorEmail = auth.user?.email || auth.adminUser?.email || 'admin';
  const rate = checkRateLimit(`drive_approve:${actorEmail}`, 30, 60000);
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

  // Handle bulk approve
  if (Array.isArray(body?.fileIds)) {
    const parseResult = bulkApproveSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid bulk approval request.', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { fileIds, category } = parseResult.data;
    const results: { fileId: string; success: boolean; error?: string }[] = [];

    for (const fId of fileIds) {
      try {
        await approveIncomingFile({
          fileId: fId,
          category,
          actorEmail,
        });
        results.push({ fileId: fId, success: true });
      } catch (err: any) {
        console.error(`[bulk approve error on file ${fId}]:`, err.message);
        results.push({
          fileId: fId,
          success: false,
          error: err.message || 'Failed to move file to Published folder.',
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
          ? `Successfully approved ${succeededCount} files into ${category}.`
          : `Approved ${succeededCount} files. ${failedCount} files failed to move.`,
    });
  }

  // Handle single approve
  const parseResult = singleApproveSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid approval request.', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { fileId, category, newName, description } = parseResult.data;

  try {
    const result = await approveIncomingFile({
      fileId,
      category,
      newName,
      description,
      actorEmail,
    });

    return NextResponse.json({
      success: true,
      message: `File '${result.file.name}' approved into ${category} successfully.`,
      file: result.file,
    });
  } catch (err: any) {
    console.error('Error approving file:', err);
    const message = err.message || 'Failed to approve file.';
    const isNotFound = message.includes('not found in the incoming uploads tree');
    const isPermission =
      message.includes('permission') || message.includes('Editor') || message.includes('forbidden');

    let userFriendlyMessage = message;
    if (isPermission) {
      userFriendlyMessage =
        'Permission denied: The service account does not have Editor access to move files into this folder. Please verify Drive sharing permissions.';
    }

    return NextResponse.json(
      {
        success: false,
        error: userFriendlyMessage,
      },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
