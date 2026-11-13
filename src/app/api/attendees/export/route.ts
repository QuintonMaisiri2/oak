import { requireStaff } from "@/lib/auth/server";
import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { Attendee } from '@/lib/types/domain';
import { getAutoEventDay } from '@/lib/event-days';
import { dedupeAttendees } from '@/lib/attendees/dedupe';

function escapeCsv(field: string | null | undefined): string {
  if (field === null || field === undefined) return '""';
  const stringified = String(field).replace(/"/g, '""');
  return `"${stringified}"`;
}

/**
 * Admin-Only Attendee CSV Export Route
 * Hard Rules:
 * - §8.5: Admin session verification, streamed/returned directly, never cached at edge (Cache-Control: private, no-store).
 */
export async function GET() {
  try {
    const access = await requireStaff();
    if (access.response) return access.response;
    let attendees: Attendee[] = [];
    const eventDay = getAutoEventDay();
    const checkedInAttendeeIds = new Set<string>();

    if (isSupabaseServerConfigured()) {
      const adminClient = access.client;

      // Fetch attendees and check-ins across all days
      const [{ data: dbAttendees, error: attError }, { data: dbCheckIns }] = await Promise.all([
        adminClient
          .from('attendees')
          .select('*')
          .order('created_at', { ascending: false }),
        adminClient.from('check_ins').select('attendee_id, event_day, scanned_at'),
      ]);

      if (attError) {
        console.error('CSV export fetch error:', attError);
        return NextResponse.json({ error: 'Failed to retrieve attendees' }, { status: 500 });
      }

      const { attendees: uniqueAttendees, canonicalId } = dedupeAttendees((dbAttendees || []) as any[]);

      const checkInsByAttendee = new Map<string, Map<string, string>>();
      if (dbCheckIns) {
        (dbCheckIns as any[]).forEach((c: any) => {
          const attendeeId = canonicalId.get(c.attendee_id) || c.attendee_id;
          checkedInAttendeeIds.add(attendeeId);
          const dayMap = checkInsByAttendee.get(attendeeId) || new Map<string, string>();
          if (!dayMap.has(c.event_day)) dayMap.set(c.event_day, c.scanned_at);
          checkInsByAttendee.set(attendeeId, dayMap);
        });
      }

      attendees = (uniqueAttendees as any[]).map((a: any) => ({
        id: a.id,
        eventCode: a.event_code || '',
        firstName: a.first_name || '',
        lastName: a.last_name || '',
        name: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim(),
        organization: a.organization || '',
        subPartner: a.sub_partner || null,
        role: a.role,
        email: a.email || '',
        phone: a.phone || null,
        dietary: a.dietary || null,
        accessibility: a.accessibility || null,
        travelNeeds: a.travel_needs || null,
        accommodation: a.accommodation || null,
        consentGivenAt: a.consent_given_at || '',
        createdAt: a.created_at || '',
      }));

      const headers = [
        'Attendee ID',
        'Event Code',
        'First Name',
        'Last Name',
        'Full Name',
        'Organisation',
        'Sub-Partner',
        'Role',
        'Email',
        'Phone',
        'Dietary Requirements',
        'Accessibility Needs',
        'Travel Needs',
        'Accommodation',
        'Day 1 (09 Nov)',
        'Day 2 (10 Nov)',
        'Day 3 (11 Nov)',
        'Total Days Attended',
        'Any Check-In',
        'Consent Given At',
        'Registration Date',
      ];

      const formatCheckIn = (scannedAt?: string) => {
        if (!scannedAt) return 'No';
        try {
          return `Checked In (${new Date(scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        } catch {
          return 'Checked In';
        }
      };

      const rows = attendees.map((a) => {
        const dayMap = checkInsByAttendee.get(a.id) || new Map<string, string>();
        const day1 = dayMap.get('2026-11-09');
        const day2 = dayMap.get('2026-11-10');
        const day3 = dayMap.get('2026-11-11');
        const totalDays = dayMap.size;

        return [
          escapeCsv(a.id),
          escapeCsv(a.eventCode),
          escapeCsv(a.firstName),
          escapeCsv(a.lastName),
          escapeCsv(a.name),
          escapeCsv(a.organization),
          escapeCsv(a.subPartner),
          escapeCsv(a.role),
          escapeCsv(a.email),
          escapeCsv(a.phone),
          escapeCsv(a.dietary),
          escapeCsv(a.accessibility),
          escapeCsv(a.travelNeeds),
          escapeCsv(a.accommodation),
          escapeCsv(formatCheckIn(day1)),
          escapeCsv(formatCheckIn(day2)),
          escapeCsv(formatCheckIn(day3)),
          escapeCsv(totalDays.toString()),
          escapeCsv(checkedInAttendeeIds.has(a.id) ? 'Yes' : 'No'),
          escapeCsv(a.consentGivenAt),
          escapeCsv(a.createdAt),
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="oak-convening-attendance-by-day.csv"`,
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    return NextResponse.json({ error: 'Supabase server not configured' }, { status: 500 });
  } catch (err) {
    console.error('Unexpected error in CSV export:', err);
    return NextResponse.json({ error: 'Failed to generate CSV export' }, { status: 500 });
  }
}
