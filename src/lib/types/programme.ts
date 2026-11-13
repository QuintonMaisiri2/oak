/**
 * Programme Type Definitions
 * OAK Zimbabwe Partner Gathering 2026
 */

export type ProgrammeViewMode = 'schedule' | 'docs';

export type SessionCategory = 
  | 'Plenary' 
  | 'Breakout' 
  | 'Workshop' 
  | 'Panel' 
  | 'Networking'
  | 'Social';

export interface Speaker {
  name: string;
  role?: string;
  organization?: string;
  avatarUrl?: string;
  initials?: string;
}

/** One of several parallel tracks running in the same session slot (e.g. breakout rounds). */
export interface SessionTrack {
  title: string;
  location?: string;
  speakers: Speaker[];
}

export interface ProgrammeSession {
  id: string;
  dayId: string; // 'day-1' | 'day-2' | 'day-3'
  startTime: string; // e.g. '09:30'
  endTime: string;   // e.g. '11:00'
  title: string;
  description?: string;
  speakers: Speaker[];
  location: string;
  category: SessionCategory;
  isFeatured?: boolean;
  tracks?: SessionTrack[];
}

export interface BreakItem {
  id: string;
  dayId: string;
  time: string; // e.g. '08:00 – 09:30'
  title: string; // e.g. 'Registration & Welcome Coffee'
  location?: string;
  type: 'break';
}

export type TimelineItem = 
  | { kind: 'session'; data: ProgrammeSession }
  | { kind: 'break'; data: BreakItem };

export interface ScheduleDay {
  id: string; // e.g. 'day-1'
  label: string; // e.g. 'Day 1'
  dateStr: string; // e.g. 'Monday, 9 November 2026'
  theme?: string;
  items: TimelineItem[];
}

export interface SessionNoteAuthor {
  name: string;
  role: string;
  organization?: string;
  avatarUrl?: string;
  initials?: string;
}

export interface SessionNote {
  id: string;
  title: string;
  summary: string;
  author: SessionNoteAuthor;
  sessionTitle: string;
  timestamp: string;
  tags?: string[];
}

export interface GalleryPhoto {
  id: string;
  title: string;
  caption?: string;
  category: string;
  aspectRatio?: 'landscape' | 'portrait' | 'square';
  colorPlaceholder: string; // Tailwind color or gradient for clean rendering
  imageUrl?: string;
}

export interface KeyTakeaway {
  id: number;
  title: string;
  description: string;
  pillar?: string;
}

export interface DownloadableResource {
  id: string;
  title: string;
  fileFormat: 'PDF' | 'DOCX' | 'XLSX' | 'ZIP';
  fileSize: string;
  category: string;
  downloadUrl: string;
  description?: string;
}

export interface ProgrammeData {
  days: ScheduleDay[];
  notes: SessionNote[];
  photos: GalleryPhoto[];
  takeaways: KeyTakeaway[];
  resources: DownloadableResource[];
}
