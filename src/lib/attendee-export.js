export function escapeCsvCell(value) {
  const raw = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(raw)) {
    return raw;
  }

  return `"${raw.replace(/"/g, '""')}"`;
}

export function buildAttendeeCsv(attendees = []) {
  const columns = [
    'registrationId',
    'firstName',
    'lastName',
    'email',
    'organization',
    'role',
    'phone',
    'dietaryRequirements',
    'accessibilityRequirements',
    'travelRequirements',
    'accommodationRequirements',
    'registrationDate',
    'registrationStatus',
    'attendanceStatus',
    'checkInTime',
    'checkInDate',
  ];

  const header = columns.join(',');
  const rows = [header];

  for (const attendee of attendees) {
    const row = columns
      .map((column) => escapeCsvCell(attendee?.[column] ?? ''))
      .join(',');
    rows.push(row);
  }

  return rows.join('\n');
}
