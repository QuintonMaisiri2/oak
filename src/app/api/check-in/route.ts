import { isSameOrigin } from "@/lib/auth/policy";
import { requireStaff } from "@/lib/auth/server";
import { NextRequest, NextResponse } from 'next/server';
import { checkInSchema } from '@/lib/validation/schemas';
import { parseScannedQrPayload } from '@/lib/qr';
import { getAutoEventDay } from '@/lib/event-days';
import { dedupeAttendees } from '@/lib/attendees/dedupe';

type AdminClient = ReturnType<typeof import('@/lib/supabase/server').createAdminClient>;

// Counts people rather than registrations, so duplicate sign-ups are counted once.
async function getUniqueAttendance(supabaseAdmin: AdminClient, day: string) {
  const [{ data: rows, error: attError }, { data: dayCheckIns, error: chkError }] = await Promise.all([
    supabaseAdmin.from('attendees').select('id, first_name, last_name, organization, created_at'),
    supabaseAdmin
      .from('check_ins')
      .select('id, attendee_id, event_day, scanned_at, attendees(first_name, last_name, organization, role)')
      .eq('event_day', day)
      .order('scanned_at', { ascending: false }),
  ]);
  if (attError || chkError) throw (attError || chkError);

  const { attendees, canonicalId } = dedupeAttendees(rows || []);
  const checkedInIds = new Set((dayCheckIns || []).map((c) => canonicalId.get(c.attendee_id) || c.attendee_id));
  return { expected: attendees.length, checkedInIds, canonicalId, dayCheckIns: dayCheckIns || [] };
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const access = await requireStaff();
    if (access.response) return access.response;
    const { user } = access;
    
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();
    
    const rawBody = await request.json();
    const validation = checkInSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid check-in payload',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { code, eventDay: providedDay, scannedAt: providedTimestamp } = validation.data;
    const targetIdentifier = parseScannedQrPayload(code);
    if (!targetIdentifier) return NextResponse.json({ error: "Invalid QR code" }, { status: 400 });
    
    // Automatically detect event day (e.g. Day 1, Day 2, Day 3, or today's date in Harare time)
    const targetDay =
      providedDay && providedDay !== "auto"
        ? providedDay
        : getAutoEventDay();

    const timestamp = providedTimestamp || new Date().toISOString();

    const cleanId = targetIdentifier.trim();
    // Find attendee by UUID or event_code
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleanId
    );
    if (!isUuid && !/^OAK-2026-\d{4}-[A-Z0-9]{4}$/i.test(cleanId)) return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });

    let attendeeQuery = supabaseAdmin.from('attendees').select('*');
    if (isUuid) {
      attendeeQuery = attendeeQuery.eq('id', cleanId);
    } else {
      attendeeQuery = attendeeQuery.eq('event_code', cleanId.toUpperCase());
    }

    const { data: attendee, error: attendeeError } = await attendeeQuery.maybeSingle();

    if (attendeeError || !attendee) {
      return NextResponse.json(
        {
          error: 'Attendee QR code not recognised',
          code: cleanId,
        },
        { status: 404 }
      );
    }

    // Check existing check-in (Hard Rule R8: idempotent check)
    const { data: existingCheckIn } = await supabaseAdmin
      .from('check_ins')
      .select('id, scanned_at, event_day')
      .eq('attendee_id', attendee.id)
      .eq('event_day', targetDay)
      .maybeSingle();

    const attendance = await getUniqueAttendance(supabaseAdmin, targetDay);
    const totalExpected = attendance.expected;
    const checkedInCount = attendance.checkedInIds.size;

    const attendeeDisplayName = attendee.name || `${attendee.first_name || ''} ${attendee.last_name || ''}`.trim();

    if (existingCheckIn) {
      return NextResponse.json({
        status: 'already_checked_in',
        message: `${attendeeDisplayName} was already checked in for today`,
        attendee: {
          id: attendee.id,
          name: attendeeDisplayName,
          organization: attendee.organization,
          role: attendee.role,
          eventCode: attendee.event_code,
          email: attendee.email,
        },
        checkIn: {
          id: existingCheckIn.id,
          scannedAt: existingCheckIn.scanned_at,
          eventDay: existingCheckIn.event_day,
        },
        stats: {
          checkedIn: checkedInCount,
          total: totalExpected,
        },
      });
    }

    // Insert new check-in record
    const { data: newCheckIn, error: insertError } = await supabaseAdmin
      .from('check_ins')
      .insert({
        attendee_id: attendee.id,
        event_day: targetDay,
        scanned_at: timestamp,
        scanned_by_admin_id: user?.id || null,
      })
      .select('id, scanned_at, event_day')
      .single();

    if (insertError) {
      // If unique constraint caught a concurrent scan, handle idempotently
      if (insertError.code === '23505') {
        return NextResponse.json({
          status: 'already_checked_in',
          message: `${attendeeDisplayName} was already checked in for today`,
          attendee: {
            id: attendee.id,
            name: attendeeDisplayName,
            organization: attendee.organization,
            role: attendee.role,
            eventCode: attendee.event_code,
            email: attendee.email,
          },
          checkIn: {
            id: crypto.randomUUID(),
            scannedAt: timestamp,
            eventDay: targetDay,
          },
          stats: {
            checkedIn: checkedInCount,
            total: totalExpected,
          },
        });
      }

      console.error('Check-in insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to record check-in in database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'checked_in',
      message: `Successfully checked in ${attendeeDisplayName}`,
      attendee: {
        id: attendee.id,
        name: attendeeDisplayName,
        organization: attendee.organization,
        role: attendee.role,
        eventCode: attendee.event_code,
        email: attendee.email,
      },
      checkIn: {
        id: newCheckIn.id,
        scannedAt: newCheckIn.scanned_at,
        eventDay: newCheckIn.event_day,
      },
      stats: {
        checkedIn: attendance.checkedInIds.has(attendance.canonicalId.get(attendee.id) || attendee.id)
          ? checkedInCount
          : checkedInCount + 1,
        total: totalExpected,
      },
    });
  } catch (err: unknown) {
    console.error('Check-in API error:', err);
    return NextResponse.json(
      { error: 'Internal server error processing check-in' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Returns summary check-in stats for dashboard
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get('day') || getAutoEventDay();

    const access = await requireStaff();
    if (access.response) return access.response;

    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const { expected, checkedInIds, dayCheckIns } = await getUniqueAttendance(supabaseAdmin, day);
    const checkedIn = checkedInIds.size;
    const pending = Math.max(0, expected - checkedIn);

    return NextResponse.json({
      day,
      stats: {
        expected,
        checkedIn,
        pending,
      },
      checkIns: dayCheckIns || [],
    });
  } catch (err: unknown) {
    console.error('Check-in stats query error:', err);
    return NextResponse.json({ error: 'Failed to fetch check-in stats' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const access = await requireStaff();
    if (access.response) return access.response;

    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const rawBody = await request.json().catch(() => ({}));
    const { code, eventDay: providedDay } = rawBody;
    if (!code) {
      return NextResponse.json({ error: 'Attendee ID or code is required' }, { status: 400 });
    }

    const targetIdentifier = parseScannedQrPayload(code);
    if (!targetIdentifier) return NextResponse.json({ error: 'Invalid QR code or identifier' }, { status: 400 });

    const targetDay =
      providedDay && providedDay !== 'auto'
        ? providedDay
        : getAutoEventDay();

    const cleanId = targetIdentifier.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

    let attendeeQuery = supabaseAdmin.from('attendees').select('id, name, first_name, last_name, event_code');
    if (isUuid) {
      attendeeQuery = attendeeQuery.eq('id', cleanId);
    } else {
      attendeeQuery = attendeeQuery.eq('event_code', cleanId.toUpperCase());
    }

    const { data: attendee, error: attendeeError } = await attendeeQuery.maybeSingle();
    if (attendeeError || !attendee) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }

    const attendeeDisplayName = attendee.name || `${attendee.first_name || ''} ${attendee.last_name || ''}`.trim();

    const { error: deleteError } = await supabaseAdmin
      .from('check_ins')
      .delete()
      .eq('attendee_id', attendee.id)
      .eq('event_day', targetDay);

    if (deleteError) {
      console.error('Check-in delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to undo check-in in database' }, { status: 500 });
    }

    return NextResponse.json({
      status: 'undone',
      message: `Check-in undone for ${attendeeDisplayName}`,
      attendeeId: attendee.id,
      eventDay: targetDay,
    });
  } catch (err: unknown) {
    console.error('Check-in DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error undoing check-in' }, { status: 500 });
  }
}
