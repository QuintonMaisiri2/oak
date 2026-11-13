import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { requireAdmin } from '@/lib/auth/server';
import { getFileStream } from '@/lib/drive/service-account';
import { sanitizeFilename } from '@/lib/drive/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  const auth = await requireAdmin();
  if (auth.response) {
    return auth.response;
  }

  const { fileId } = await context.params;
  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get('download') === 'true';

  try {
    const fileData = await getFileStream(fileId);
    const cleanFilename = sanitizeFilename(fileData.name);
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const disposition = `${dispositionType}; filename="${cleanFilename}"`;

    // Convert Node stream to Web ReadableStream
    const webStream = Readable.toWeb(fileData.stream as Readable);

    const headers: Record<string, string> = {
      'Content-Type': fileData.mimeType || 'application/octet-stream',
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    };

    if (fileData.size && fileData.size > 0) {
      headers['Content-Length'] = String(fileData.size);
    }

    return new Response(webStream as any, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error(`[drive stream error for ${fileId}]:`, err.message);
    const message = err.message || 'File not found or cannot be streamed.';
    const isNotFound =
      message.includes('not found') || message.includes('Invalid Google Drive file ID');

    return NextResponse.json(
      { error: message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
