import { canAccessSharedFiles } from '@/lib/auth/drive-access';
import { getDriveConfig, isValidDriveId, verifyAndGetDownloadMetadata } from '@/lib/drive/client';
import { driveFetch } from '@/lib/drive/read-auth';

export const dynamic = 'force-dynamic';

/** Thumbnails for files in a private Drive folder, served only to signed-in attendees and staff. */
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  if (!(await canAccessSharedFiles())) {
    return new Response('Sign in to view shared files.', { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId || !isValidDriveId(fileId) || !(await verifyAndGetDownloadMetadata(fileId))) {
    return new Response('Not found', { status: 404 });
  }

  const config = getDriveConfig();
  const metaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  metaUrl.searchParams.set('fields', 'thumbnailLink');
  const metaRes = await driveFetch(metaUrl, config.apiKey);
  const thumbnailLink: string | undefined = metaRes.ok ? (await metaRes.json()).thumbnailLink : undefined;
  if (!thumbnailLink) return new Response('Not found', { status: 404 });

  const requested = Number(new URL(request.url).searchParams.get('s'));
  const size = Number.isFinite(requested) && requested >= 100 && requested <= 2000 ? Math.round(requested) : 1200;
  const imageRes = await driveFetch(thumbnailLink.replace(/=s\d+$/, `=s${size}`), config.apiKey);
  if (!imageRes.ok || !imageRes.body) return new Response('Thumbnail unavailable', { status: 502 });

  return new Response(imageRes.body, {
    headers: {
      'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
