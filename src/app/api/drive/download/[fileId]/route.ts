import { NextRequest, NextResponse } from 'next/server';
import { driveFetch } from '@/lib/drive/read-auth';
import {
  getDriveConfig,
  isValidDriveId,
  verifyAndGetDownloadMetadata,
  formatFileSize,
} from '@/lib/drive/client';
import { canAccessSharedFiles } from '@/lib/auth/drive-access';

// In-memory rate limiter per IP: max 30 requests per 60 seconds
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // 1. Rate Limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous-client';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Download rate limit exceeded. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // 2. Authorization check: Only registered attendees and staff can download shared files
    const allowed = await canAccessSharedFiles();
    if (!allowed) {
      const acceptHeader = request.headers.get('accept') || '';
      if (acceptHeader.includes('text/html')) {
        return NextResponse.redirect(new URL('/drive', request.url));
      }
      return NextResponse.json(
        { error: 'Access restricted. You must be registered or logged in to access shared files.' },
        { status: 401 }
      );
    }

    // 3. Validate fileId pattern
    const { fileId } = await params;
    const sanitizedId = fileId?.trim();
    if (!sanitizedId || !isValidDriveId(sanitizedId)) {
      return NextResponse.json({ error: 'Invalid file identifier.' }, { status: 400 });
    }

    // 3. Verify file is in Published folder (Directly or via Subfolder)
    const fileMeta = await verifyAndGetDownloadMetadata(sanitizedId);
    if (!fileMeta) {
      // Return 404 to stop any guessing of Drive IDs outside Published
      return NextResponse.json(
        { error: 'File not found or not published.' },
        { status: 404 }
      );
    }

    const config = getDriveConfig();
    const maxBytes = config.maxDownloadMb * 1024 * 1024;

    // 4. Check File Size Limit
    if (fileMeta.size > maxBytes) {
      const formattedSize = formatFileSize(fileMeta.size);
      const driveUrl = fileMeta.webViewLink || 'https://drive.google.com';
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>File Size Exceeds Limit</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
              .card { max-width: 480px; padding: 32px; background: white; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; text-align: center; }
              h1 { font-size: 20px; margin-top: 0; color: #0f172a; }
              p { font-size: 14px; color: #64748b; line-height: 1.6; }
              .badge { display: inline-block; padding: 4px 12px; background: #eff6ff; color: #1d4ed8; border-radius: 9999px; font-weight: 600; font-size: 12px; margin-bottom: 16px; }
              .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #1C2C4F; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="card">
              <span class="badge">Size Limit Exceeded</span>
              <h1>File Exceeds Download Limit</h1>
              <p>
                "${fileMeta.name}" is <strong>${formattedSize}</strong>, which exceeds the maximum direct download limit of <strong>${config.maxDownloadMb} MB</strong>.
              </p>
              <p>
                You can view or download this file directly in Google Drive instead.
              </p>
              <a href="${driveUrl}" class="btn" target="_blank" rel="noopener noreferrer">Open in Google Drive</a>
            </div>
          </body>
        </html>`,
        {
          status: 413,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // 5. Stream from Drive API
    let driveUrl: string;
    let contentType = fileMeta.mimeType;

    if (fileMeta.exportMimeType) {
      // Google-native file export (Docs -> PDF, Sheets -> XLSX, Slides -> PPTX)
      driveUrl = `https://www.googleapis.com/drive/v3/files/${sanitizedId}/export?mimeType=${encodeURIComponent(
        fileMeta.exportMimeType
      )}`;
      contentType = fileMeta.exportMimeType;
    } else {
      // Standard binary / media download
      driveUrl = `https://www.googleapis.com/drive/v3/files/${sanitizedId}?alt=media`;
    }

    const driveRes = await driveFetch(driveUrl, config.apiKey);
    if (!driveRes.ok) {
      console.error(
        `Failed to fetch file ${sanitizedId} from Drive: HTTP ${driveRes.status}`
      );
      return NextResponse.json(
        { error: 'Failed to retrieve file from Google Drive.' },
        { status: 502 }
      );
    }

    if (!driveRes.body) {
      return NextResponse.json({ error: 'Empty response body from Drive.' }, { status: 502 });
    }

    // 6. Return streamed response with sanitized headers (support inline preview)
    const isInline =
      request.nextUrl.searchParams.get('inline') === 'true' ||
      request.nextUrl.searchParams.get('preview') === 'true';
    const sanitizedName = fileMeta.downloadFilename;
    const asciiFilename = sanitizedName.replace(/[^\x20-\x7E]/g, '_');
    const dispositionType = isInline ? 'inline' : 'attachment';
    const contentDisposition = `${dispositionType}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
      sanitizedName
    )}`;

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Disposition', contentDisposition);
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set(
      'Cache-Control',
      isInline
        ? 'private, max-age=3600'
        : 'private, max-age=300'
    );

    const contentLength = driveRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    return new Response(driveRes.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('Error in /api/drive/download/[fileId]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
