import { NextResponse } from 'next/server';
import { getPartners } from '@/lib/directory/server';
import { getAgenda } from '@/lib/programme/agenda-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [directoryPartners, { days }] = await Promise.all([getPartners(), getAgenda()]);

    return NextResponse.json({
      sessions: days.reduce((count, day) => count + day.items.filter(item => item.kind === 'session').length, 0),
      partners: directoryPartners.length,
    });
  } catch (err: unknown) {
    console.error('Error fetching actual metrics:', err);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
