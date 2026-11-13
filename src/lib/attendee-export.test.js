import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAttendeeCsv, escapeCsvCell } from './attendee-export.js';

test('escapeCsvCell quotes values with commas and quotes', () => {
  assert.equal(escapeCsvCell('Jane, "Doe"'), '"Jane, ""Doe"""');
});

test('buildAttendeeCsv includes headers and attendee data', () => {
  const csv = buildAttendeeCsv([
    {
      registrationId: 'OA-1001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.org',
      organization: 'Analytical Engine, UK',
      role: 'Presenter',
      phone: '+44 20 0000 0000',
      dietaryRequirements: 'Vegetarian',
      accessibilityRequirements: 'Wheelchair, step-free',
      travelRequirements: '',
      accommodationRequirements: '',
      registrationDate: '2026-09-01T09:00:00.000Z',
      registrationStatus: 'Registered',
      attendanceStatus: 'Pending',
      checkInTime: null,
      checkInDate: null,
    },
  ]);

  assert.match(csv, /^registrationId,firstName,/) ;
  assert.match(csv, /OA-1001/);
  assert.match(csv, /"Analytical Engine, UK"/);
  assert.match(csv, /"Wheelchair, step-free"/);
});
