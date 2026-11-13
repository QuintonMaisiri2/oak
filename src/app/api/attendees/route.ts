import { requireStaff } from "@/lib/auth/server";
import { NextRequest, NextResponse } from 'next/server';
import { getAutoEventDay } from '@/lib/event-days';
import { dedupeAttendees } from '@/lib/attendees/dedupe';

export async function GET(request: NextRequest) {
  try {
    const access = await requireStaff();
    if (access.response) return access.response;

    const { searchParams } = new URL(request.url);
    const requestedDay = searchParams.get('day');
    const defaultEventDay = getAutoEventDay();
    const activeDay = requestedDay && requestedDay !== 'all' ? requestedDay : defaultEventDay;

    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const [{ data: dbAttendees, error: attError }, { data: dbCheckIns }] = await Promise.all([
      supabaseAdmin
        .from('attendees')
        .select('*')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('check_ins')
        .select('attendee_id, scanned_at, event_day')
        .order('scanned_at', { ascending: false }),
    ]);

    if (attError) {
      console.error('Error fetching attendees in /api/attendees:', attError);
      throw attError;
    }

    const { attendees, canonicalId } = dedupeAttendees(dbAttendees || []);

    const checkInsByAttendee = new Map<string, { scanned_at: string; event_day: string }[]>();
    if (dbCheckIns) {
      dbCheckIns.forEach((c) => {
        const attendeeId = canonicalId.get(c.attendee_id) || c.attendee_id;
        const list = checkInsByAttendee.get(attendeeId) || [];
        if (!list.some((existing) => existing.event_day === c.event_day)) {
          list.push({ scanned_at: c.scanned_at, event_day: c.event_day });
        }
        checkInsByAttendee.set(attendeeId, list);
      });
    }

    const formatted = attendees.map((a) => {
      const allCheckIns = checkInsByAttendee.get(a.id) || [];
      const dayCheckIn = allCheckIns.find((c) => c.event_day === activeDay);
      const isCheckedIn = Boolean(requestedDay === 'all' ? allCheckIns.length > 0 : dayCheckIn);
      const primaryCheckIn = dayCheckIn || allCheckIns[0];

      return {
        registrationId: a.event_code || a.id,
        qrCodeId: a.event_code || a.id,
        firstName: a.first_name,
        lastName: a.last_name,
        organization: a.organization,
        subPartnerProgramArea: a.sub_partner || undefined,
        role: a.role,
        email: a.email,
        phone: a.phone || undefined,
        dietaryRequirements: a.dietary || undefined,
        accessibilityRequirements: a.accessibility || undefined,
        travelRequirements: a.travel_needs || undefined,
        accommodationRequirements: a.accommodation || undefined,
        registrationDate: a.created_at,
        registrationStatus: 'Registered' as const,
        attendanceStatus: isCheckedIn ? ('Checked In' as const) : ('Pending' as const),
        checkInTime: primaryCheckIn?.scanned_at || null,
        checkInDate: primaryCheckIn?.event_day || null,
        checkIns: allCheckIns.map((c) => ({ eventDay: c.event_day, scannedAt: c.scanned_at })),
      };
    });

    return NextResponse.json(formatted);
  } catch (err: unknown) {
    console.error('Error in /api/attendees:', err);
    return NextResponse.json({ error: 'Failed to list attendees' }, { status: 500 });
  }
}
