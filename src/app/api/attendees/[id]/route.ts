import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { isStaffUserAsync, AUTH_COOKIE_OPTIONS } from '@/lib/auth/policy';
import { normalizeEmail } from '@/lib/auth/allowlist';
import { getAutoEventDay } from '@/lib/event-days';
import { requireSuperAdmin } from '@/lib/auth/server';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = id.trim();
    if (!/^(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|OAK-2026-\d{4}-[A-Z0-9]{4})$/i.test(decodedId)) {
      return NextResponse.json({ error: 'Invalid attendee identifier' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(decodedId);

    let query = adminClient
      .from('attendees')
      .select('id,event_code,first_name,last_name,organization,sub_partner,role,email,created_at');

    if (isUuid) {
      query = query.eq('id', decodedId);
    } else {
      query = query.eq('event_code', decodedId.toUpperCase());
    }

    const { data: attendee, error } = await query.maybeSingle();

    if (error) {
      console.error('Error fetching attendee from Supabase:', error);
      throw error;
    }

    if (!attendee) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }

    // Authenticate the requesting user via Supabase Auth (Google OAuth)
    let currentUserEmail: string | null = null;
    let isStaff = false;

    if (isSupabaseServerConfigured()) {
      try {
        const client = await createClient();
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (!authError && user && user.email) {
          currentUserEmail = normalizeEmail(user.email);
          isStaff = await isStaffUserAsync(user);
        }
      } catch (authErr) {
        console.error('Auth verification error in attendee API:', authErr);
      }
    }

    // Protected Route Rule:
    // A user can ONLY see their ticket if they sign in using Continue with Google!
    if (!currentUserEmail) {
      return NextResponse.json(
        {
          error: 'Sign in with Google is required to view this ticket.',
          requiresAuth: true,
          eventCode: attendee.event_code,
        },
        { status: 401 }
      );
    }

    const attendeeEmail = normalizeEmail(attendee.email);
    const ownsTicket = currentUserEmail === attendeeEmail;

    if (!isStaff && !ownsTicket) {
      return NextResponse.json(
        {
          error: `Access restricted. You are signed in as "${currentUserEmail}", which does not match this ticket's registered email.`,
          unauthorizedAccount: currentUserEmail,
          requiresAuth: true,
        },
        { status: 403 }
      );
    }

    // Check check-in status for today
    const eventDay = getAutoEventDay();
    const { data: checkIn } = await adminClient
      .from('check_ins')
      .select('*')
      .eq('attendee_id', attendee.id)
      .eq('event_day', eventDay)
      .maybeSingle();

    const res = NextResponse.json(
      {
        registrationId: attendee.event_code,
        qrCodeId: attendee.event_code,
        firstName: attendee.first_name,
        lastName: attendee.last_name,
        organization: attendee.organization,
        subPartnerProgramArea: attendee.sub_partner || undefined,
        role: attendee.role,
        email: attendee.email,
        registrationDate: attendee.created_at,
        registrationStatus: 'Registered',
        attendanceStatus: checkIn ? 'Checked In' : 'Pending',
        checkInTime: checkIn?.scanned_at || null,
        checkInDate: checkIn?.event_day || null,
      },
      { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } }
    );

    res.cookies.set('oak_partner_pass', attendee.event_code, {
      ...AUTH_COOKIE_OPTIONS,
      expires: new Date('2026-11-11T23:59:59Z'),
    });

    return res;
  } catch (error) {
    console.error('Error fetching attendee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response) {
      return auth.response;
    }

    const { id } = await params;
    const decodedId = id?.trim();
    if (!decodedId || !/^(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|OAK-2026-\d{4}-[A-Z0-9]{4})$/i.test(decodedId)) {
      return NextResponse.json({ error: 'Invalid attendee identifier' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(decodedId);

    let query = adminClient
      .from('attendees')
      .select('id,event_code,first_name,last_name,organization,role,email');

    if (isUuid) {
      query = query.eq('id', decodedId);
    } else {
      query = query.eq('event_code', decodedId.toUpperCase());
    }

    const { data: attendee, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error('Error finding attendee to delete:', fetchError);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    if (!attendee) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }

    // Clean up associated check-ins first to prevent constraint violations on non-cascading environments
    await adminClient
      .from('check_ins')
      .delete()
      .eq('attendee_id', attendee.id);

    // Delete attendee record
    const { error: deleteError } = await adminClient
      .from('attendees')
      .delete()
      .eq('id', attendee.id);

    if (deleteError) {
      console.error('Error deleting attendee from Supabase:', deleteError);
      return NextResponse.json({ error: 'Failed to delete attendee record' }, { status: 500 });
    }

    const attendeeName =
      `${attendee.first_name || ''} ${attendee.last_name || ''}`.trim() ||
      attendee.email;

    await logAuditEvent({
      action: 'attendee_deleted',
      actor_email: auth.user?.email || auth.adminUser?.email,
      target_email: attendee.email,
      details: {
        attendee_id: attendee.id,
        event_code: attendee.event_code,
        name: attendeeName,
        organization: attendee.organization,
        role: attendee.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Attendee "${attendeeName}" deleted successfully.`,
      deletedId: attendee.id,
      deletedEventCode: attendee.event_code,
    });
  } catch (error) {
    console.error('Error in DELETE /api/attendees/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
