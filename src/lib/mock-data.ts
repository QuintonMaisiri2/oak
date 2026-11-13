import type { Attendee, CheckIn } from './types/domain';

// Default initial attendees
export const initialMockAttendees: Attendee[] = [
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000001',
    eventCode: 'OAK-2026-7842-XKPH',
    firstName: 'Maria',
    lastName: 'Schmidt',
    name: 'Maria Schmidt',
    organization: 'Open Society Foundations',
    subPartner: null,
    role: 'Grantee',
    email: 'maria.schmidt@opensociety.org',
    phone: '+41 22 730 0100',
    dietary: 'Vegetarian',
    accessibility: null,
    travelNeeds: 'Airport transfer required',
    accommodation: 'Cresta Lodge Room 104',
    consentGivenAt: '2026-03-01T10:00:00Z',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'b1a2c3d4-0002-4000-8000-000000000002',
    eventCode: 'OAK-2026-1193-JWQA',
    firstName: 'James',
    lastName: 'Odhiambo',
    name: 'James Odhiambo',
    organization: 'OAK Foundation',
    subPartner: null,
    role: 'OAK Staff',
    email: 'james.odhiambo@oakfnd.org',
    phone: '+263 77 123 4567',
    dietary: null,
    accessibility: null,
    travelNeeds: null,
    accommodation: 'Cresta Lodge Room 212',
    consentGivenAt: '2026-03-02T11:00:00Z',
    createdAt: '2026-03-02T11:00:00Z',
  },
  {
    id: 'b1a2c3d4-0003-4000-8000-000000000003',
    eventCode: 'OAK-2026-3310-ADGE',
    firstName: 'Awa',
    lastName: 'Diallo',
    name: 'Awa Diallo',
    organization: 'West Africa Tech Initiative',
    subPartner: 'TechHub Harare',
    role: 'Coordination Team',
    email: 'awa.diallo@watech.org',
    phone: '+221 77 555 1234',
    dietary: 'Halal',
    accessibility: null,
    travelNeeds: 'Late arrival Day 1',
    accommodation: 'Cresta Lodge Room 305',
    consentGivenAt: '2026-03-03T12:00:00Z',
    createdAt: '2026-03-03T12:00:00Z',
  },
  {
    id: 'b1a2c3d4-0004-4000-8000-000000000004',
    eventCode: 'OAK-2026-4421-MPLK',
    firstName: 'Tinashe',
    lastName: 'Smith',
    name: 'Tinashe Smith',
    organization: 'Uncommon.org',
    subPartner: null,
    role: 'Grantee',
    email: 'tinashe@uncommon.org',
    phone: '+263 71 987 6543',
    dietary: null,
    accessibility: null,
    travelNeeds: null,
    accommodation: 'Local resident',
    consentGivenAt: '2026-03-04T09:30:00Z',
    createdAt: '2026-03-04T09:30:00Z',
  },
];

// In-memory fallback stores for local development without active DB
declare global {
  var __mockAttendees: Attendee[] | undefined;
  var __mockCheckIns: CheckIn[] | undefined;
}

export function getMockAttendees(): Attendee[] {
  if (!globalThis.__mockAttendees) {
    globalThis.__mockAttendees = [...initialMockAttendees];
  }
  return globalThis.__mockAttendees;
}

export function addMockAttendee(attendee: Attendee): Attendee {
  const list = getMockAttendees();
  list.unshift(attendee);
  return attendee;
}

export function getMockCheckIns(): CheckIn[] {
  if (!globalThis.__mockCheckIns) {
    globalThis.__mockCheckIns = [];
  }
  return globalThis.__mockCheckIns;
}

export function addMockCheckIn(checkIn: CheckIn): { status: 'checked_in' | 'already_checked_in'; checkIn: CheckIn } {
  const list = getMockCheckIns();
  const existing = list.find(
    (c) => c.attendeeId === checkIn.attendeeId && c.eventDay === checkIn.eventDay
  );

  if (existing) {
    return { status: 'already_checked_in', checkIn: existing };
  }

  list.unshift(checkIn);
  return { status: 'checked_in', checkIn };
}
