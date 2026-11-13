export type AttendeeRole =
  | 'Grantee'
  | 'OAK Staff'
  | 'Coordination Team'
  | 'Presenter'
  | 'Observer';

export type Attendee = {
  id: string;
  eventCode: string;
  firstName: string;
  lastName: string;
  name: string;
  organization: string;
  subPartner: string | null;
  role: AttendeeRole;
  email: string;
  phone: string | null;
  dietary: string | null;
  accessibility: string | null;
  travelNeeds: string | null;
  accommodation: string | null;
  consentGivenAt: string;
  createdAt: string;
};

// Hard Rule R1: Public-safe projection. Never include email, phone, dietary, accessibility, or travelNeeds
export type AttendeePublic = Pick<
  Attendee,
  'id' | 'eventCode' | 'firstName' | 'lastName' | 'name' | 'organization' | 'subPartner' | 'role'
>;

export type CheckIn = {
  id: string;
  attendeeId: string;
  eventDay: string;
  scannedAt: string;
  scannedByAdminId: string | null;
};

export type CheckInWithAttendee = CheckIn & {
  attendee: Attendee;
};

export type Session = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  duration?: string;
  title: string;
  speaker?: string | null;
  location: string;
  category: 'Plenary' | 'Breakout' | 'Workshop' | 'Social';
  isFeatured?: boolean;
};

export type DocumentationPost = {
  id: string;
  day: string;
  notes: string;
  photoUrls: string[];
  authorName?: string | null;
  authorInitials?: string | null;
  authorOrg?: string | null;
  createdAt?: string;
};

export type PartnerOrg = {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  region: string;
  tags?: string[];
  since?: string;
  isSubPartner: boolean;
  parentOrgId: string | null;
};
