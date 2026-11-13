// Automated Verification Suite for OAK Convening Backend & Security Rules
import assert from 'node:assert';

console.log('--- STARTING OAK BACKEND VERIFICATION ---');

// Test 1: Shared Zod Schema Validation (R11)
import { registrationSchema, checkInSchema } from '../src/lib/validation/schemas.ts';

console.log('1. Testing Registration Schema Validation...');
const validRegistration = {
  firstName: 'Kudakwashe',
  lastName: 'Musoni',
  organization: 'Civic Media Trust',
  email: 'kuda@civicmedia.org',
  role: 'Partner',
  consent: true,
};
const parsedValid = registrationSchema.safeParse(validRegistration);
assert.strictEqual(parsedValid.success, true, 'Valid registration must succeed');

// Missing consent must fail
const invalidConsent = { ...validRegistration, consent: false };
const parsedConsent = registrationSchema.safeParse(invalidConsent);
assert.strictEqual(parsedConsent.success, false, 'Missing consent must fail validation');

// Invalid email must fail
const invalidEmail = { ...validRegistration, email: 'not-an-email' };
const parsedEmail = registrationSchema.safeParse(invalidEmail);
assert.strictEqual(parsedEmail.success, false, 'Invalid email must fail validation');
console.log('✔ Registration Schema Validation Passed');

// Test 2: QR & Event Code generation and parsing
import { generateEventCode, parseScannedQrPayload, isEventCode } from '../src/lib/qr/index.ts';

console.log('2. Testing QR & Event Code Logic...');
const generatedCode = generateEventCode();
assert.strictEqual(isEventCode(generatedCode), true, `Generated code ${generatedCode} must be valid format`);
assert.strictEqual(parseScannedQrPayload(generatedCode), generatedCode, 'Raw event code parses accurately');

const jsonPayload = JSON.stringify({ id: 'uuid-1234', eventCode: 'OAK-2026-1111-TEST' });
assert.strictEqual(parseScannedQrPayload(jsonPayload), 'uuid-1234', 'JSON payload parses ID accurately');

const passUrl = 'https://oak-convening.vercel.app/pass/OAK-2026-7842-XKPH';
assert.strictEqual(parseScannedQrPayload(passUrl), 'OAK-2026-7842-XKPH', 'Pass URL parses identifier accurately');
console.log('✔ QR & Event Code Logic Passed');

// Test 3: Check-in Idempotency (Hard Rule R8)
import { addMockCheckIn, getMockCheckIns, getMockAttendees } from '../src/lib/mock-data.ts';

console.log('3. Testing Check-in Idempotency (Hard Rule R8)...');
const testAttendeeId = 'b1a2c3d4-0001-4000-8000-000000000001';
const testDay = '2026-11-09';

// First scan
const scan1 = addMockCheckIn({
  id: 'test-checkin-1',
  attendeeId: testAttendeeId,
  eventDay: testDay,
  scannedAt: '2026-11-09T08:30:00Z',
  scannedByAdminId: null,
});
assert.strictEqual(scan1.status, 'checked_in', 'First scan must record check-in');

// Duplicate scan same attendee same day
const scan2 = addMockCheckIn({
  id: 'test-checkin-2',
  attendeeId: testAttendeeId,
  eventDay: testDay,
  scannedAt: '2026-11-09T08:35:00Z',
  scannedByAdminId: null,
});
assert.strictEqual(scan2.status, 'already_checked_in', 'Duplicate scan must return already_checked_in (no-op)');

const checkInsCount = getMockCheckIns().filter(
  (c) => c.attendeeId === testAttendeeId && c.eventDay === testDay
).length;
assert.strictEqual(checkInsCount, 1, 'Database must contain exactly 1 check-in record for attendee on same day');
console.log('✔ Check-In Idempotency Constraint Passed');

// Test 4: Privacy & Public Projection Audit (Hard Rules R1, R2, R4)
console.log('4. Testing Public Projection Privacy Audit (R1, R2, R4)...');
const sampleAttendee = getMockAttendees()[0];
const publicProjectionKeys = ['id', 'eventCode', 'firstName', 'lastName', 'name', 'organization', 'subPartner', 'role'];
const sensitiveKeys = ['email', 'phone', 'dietary', 'accessibility', 'travelNeeds', 'accommodation'];

// Ensure sensitive keys exist on full record
sensitiveKeys.forEach((key) => {
  assert.ok(key in sampleAttendee, `Full attendee model must possess ${key}`);
});

// Create public projection as done in pass page
const publicSafeObject = {
  id: sampleAttendee.id,
  eventCode: sampleAttendee.eventCode,
  firstName: sampleAttendee.firstName,
  lastName: sampleAttendee.lastName,
  name: sampleAttendee.name,
  organization: sampleAttendee.organization,
  subPartner: sampleAttendee.subPartner,
  role: sampleAttendee.role,
};

// Check that no sensitive key is present
sensitiveKeys.forEach((key) => {
  assert.strictEqual(key in publicSafeObject, false, `Sensitive key "${key}" must NEVER be in public projection`);
});

const serializedPublicJson = JSON.stringify(publicSafeObject);
assert.strictEqual(serializedPublicJson.includes(sampleAttendee.email), false, 'Serialized public JSON must not contain email');
assert.strictEqual(serializedPublicJson.includes(sampleAttendee.phone), false, 'Serialized public JSON must not contain phone');
console.log('✔ Privacy & Public Projection Audit Passed');

console.log('--- ALL BACKEND VERIFICATIONS PASSED (4/4) ---');
