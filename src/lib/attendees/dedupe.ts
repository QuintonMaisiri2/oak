type AttendeeRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
  created_at: string;
};

const normalize = (value: string | null | undefined) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Some people registered more than once under different emails. The same
// name at the same organisation is treated as one person.
export function attendeeIdentityKey(a: AttendeeRow): string {
  return `${normalize(`${a.first_name} ${a.last_name}`)}|${normalize(a.organization)}`;
}

/**
 * Collapses duplicate registrations, keeping the earliest one for each person.
 * `canonicalId` maps every attendee id (including dropped duplicates) to the
 * kept id, so check-ins recorded against a duplicate pass still count.
 */
export function dedupeAttendees<T extends AttendeeRow>(rows: T[]) {
  const keptByKey = new Map<string, T>();
  for (const row of rows) {
    const key = attendeeIdentityKey(row);
    const kept = keptByKey.get(key);
    if (!kept || row.created_at < kept.created_at) keptByKey.set(key, row);
  }

  const canonicalId = new Map<string, string>();
  for (const row of rows) canonicalId.set(row.id, keptByKey.get(attendeeIdentityKey(row))!.id);

  const kept = new Set(keptByKey.values());
  return { attendees: rows.filter((row) => kept.has(row)), canonicalId };
}
