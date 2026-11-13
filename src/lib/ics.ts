import crypto from "crypto";

export interface IcsEventOptions {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  location?: string;
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateIcsContent(options: IcsEventOptions): string {
  const uid = crypto.randomUUID();
  const now = formatIcsDate(new Date());
  const dtStart = formatIcsDate(options.startTime);
  const dtEnd = formatIcsDate(options.endTime);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Oak Foundation//1:1 Advisor Clinic Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}@oakfnd.org`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(options.title)}`,
    `DESCRIPTION:${escapeIcsText(options.description)}`,
    `ORGANIZER;CN=${escapeIcsText(options.organizerName)}:mailto:${options.organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${escapeIcsText(options.attendeeName)}:mailto:${options.attendeeEmail}`,
    `LOCATION:${escapeIcsText(options.location || "Oak Foundation Convening, Cresta Lodge Harare")}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
