import { createAdminClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { Attendee } from '@/lib/types/domain';
import { dedupeAttendees } from '@/lib/attendees/dedupe';
import { NametagsClientView } from '@/components/admin/NametagsClientView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Print Nametags | Admin | OAK Grantee Convening',
};

export default async function NametagsPage() {
  const access = await requireStaff();
  if (access.response) {
    redirect('/admin/login?next=/admin/nametags');
  }

  let attendees: Attendee[] = [];

  if (isSupabaseServerConfigured()) {
    try {
      const adminClient = createAdminClient();
      const { data: dbAttendees } = await adminClient
        .from('attendees')
        .select('*')
        .order('last_name', { ascending: true });

      if (dbAttendees && dbAttendees.length > 0) {
        attendees = dedupeAttendees(dbAttendees).attendees.map((a) => ({
          id: a.id,
          eventCode: a.event_code || a.id,
          firstName: a.first_name || '',
          lastName: a.last_name || '',
          name: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Attendee',
          organization: a.organization || 'Participant',
          subPartner: a.sub_partner,
          role: a.role || 'Grantee',
          email: a.email || '',
          phone: a.phone,
          dietary: a.dietary,
          accessibility: a.accessibility,
          travelNeeds: a.travel_needs,
          accommodation: a.accommodation,
          consentGivenAt: a.consent_given_at || '',
          createdAt: a.created_at || '',
        }));
      }
    } catch (err) {
      console.error('Failed to load attendees for nametags:', err);
    }
  }

  return <NametagsClientView attendees={attendees} />;
}
