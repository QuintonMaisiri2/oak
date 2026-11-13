import { createAdminClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { Attendee } from '@/lib/types/domain';
import { AttendeesTable } from '@/components/admin/AttendeesTable';
import { getAutoEventDay } from '@/lib/event-days';
import { dedupeAttendees } from '@/lib/attendees/dedupe';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Registered Attendees | Admin | OAK Grantee Convening',
};

export default async function AdminAttendeesPage() {
  const access = await requireStaff();
  if (access.response) {
    redirect('/admin/login?next=/admin/attendees');
  }

  const isSuperAdmin = access.adminUser?.role === 'super_admin';

  let attendees: Attendee[] = [];
  const checkedInIds: string[] = [];
  const checkInDaysMap: Record<string, string[]> = {};
  const checkInHistoryMap: Record<string, { eventDay: string; scannedAt: string }[]> = {};
  const eventDay = getAutoEventDay();

  if (isSupabaseServerConfigured()) {
    try {
      const adminClient = createAdminClient();
      const [{ data: dbAttendees }, { data: dbCheckIns }] = await Promise.all([
        adminClient
          .from('attendees')
          .select('*')
          .order('created_at', { ascending: false }),
        adminClient
          .from('check_ins')
          .select('attendee_id, event_day, scanned_at')
          .order('scanned_at', { ascending: false }),
      ]);

      const { attendees: uniqueAttendees, canonicalId } = dedupeAttendees(dbAttendees || []);

      if (dbAttendees) {
        attendees = uniqueAttendees.map((a) => ({
          id: a.id,
          eventCode: a.event_code,
          firstName: a.first_name,
          lastName: a.last_name,
          name: a.name || `${a.first_name} ${a.last_name}`.trim(),
          organization: a.organization,
          subPartner: a.sub_partner,
          role: a.role,
          email: a.email,
          phone: a.phone,
          dietary: a.dietary,
          accessibility: a.accessibility,
          travelNeeds: a.travel_needs,
          accommodation: a.accommodation,
          consentGivenAt: a.consent_given_at,
          createdAt: a.created_at,
        }));
      }

      if (dbCheckIns) {
        dbCheckIns.forEach((c) => {
          const attendeeId = canonicalId.get(c.attendee_id) || c.attendee_id;
          if (!checkedInIds.includes(attendeeId)) checkedInIds.push(attendeeId);

          const days = checkInDaysMap[attendeeId] || [];
          if (!days.includes(c.event_day)) days.push(c.event_day);
          checkInDaysMap[attendeeId] = days;

          const history = checkInHistoryMap[attendeeId] || [];
          if (!history.some((h) => h.eventDay === c.event_day && h.scannedAt === c.scanned_at)) {
            history.push({ eventDay: c.event_day, scannedAt: c.scanned_at });
          }
          checkInHistoryMap[attendeeId] = history;
        });
      }
    } catch (err) {
      console.error('Failed to query attendees in admin page:', err);
    }
  }

  return (
    <div className="page-container space-y-6">
      <AttendeesTable
        initialAttendees={attendees}
        checkedInIds={checkedInIds}
        checkInDaysMap={checkInDaysMap}
        checkInHistoryMap={checkInHistoryMap}
        isSuperAdmin={isSuperAdmin}
        activeEventDay={eventDay}
      />
    </div>
  );
}
