import { randomInt } from 'node:crypto';
import { canAccessSharedFiles } from '@/lib/auth/drive-access';
import { getPublishedDriveFiles } from '@/lib/drive/client';
import { GALLERY_SIZE } from '@/lib/programme/gallery-picks';

export const dynamic = 'force-dynamic';

/** Picks `count` items at random (partial Fisher-Yates shuffle), without changing `items`. */
function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/**
 * The Photo Gallery for one convening day: a fresh random selection from that day's
 * Drive folder (e.g. "Day 1 Photos") on every request. Attendees and staff only.
 */
export async function GET(request: Request) {
  if (!(await canAccessSharedFiles())) {
    return Response.json({ error: 'Sign in to view convening photos.' }, { status: 401 });
  }

  const day = new URL(request.url).searchParams.get('day') ?? '';
  const dayNumber = /^Day ([1-9])$/.exec(day)?.[1];
  if (!dayNumber) return Response.json({ error: 'Choose a day.' }, { status: 400 });

  const drive = await getPublishedDriveFiles();
  const folderPattern = new RegExp(`^day\\s*${dayNumber}\\b`, 'i');
  const dayPhotos = drive.files.filter(file => folderPattern.test(file.category) && file.fileTypeCategory === 'image');
  const chosen = pickRandom(dayPhotos, GALLERY_SIZE);

  return Response.json(
    {
      total: dayPhotos.length,
      photos: chosen.map(file => ({
        id: file.id,
        name: file.name,
        thumbnail: `/api/drive/thumbnail/${encodeURIComponent(file.id)}?s=800`,
        full: `/api/drive/download/${encodeURIComponent(file.id)}?inline=true`,
      })),
    },
    // Never cache: each page load should get a new random set.
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
