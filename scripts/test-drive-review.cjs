/**
 * Verification test suite for Drive Approval Workflow logic:
 * 1. Key normalization (PEM, literal \n, base64 JSON, raw JSON)
 * 2. Filename sanitization
 * 3. Rate limiting logic
 * 4. Role enforcement rules
 */

const assert = require('assert');

// 1. Test Key Normalization logic
function normalizePrivateKey(rawKey) {
  let cleaned = rawKey.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/\\n/g, '\n');
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return cleaned.trim();
}

function parseServiceAccountKey(rawKey) {
  if (!rawKey) return {};
  const trimmed = rawKey.trim();
  if (!trimmed) return {};

  // 1. Try base64 JSON
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (decoded.includes('{') && decoded.includes('private_key')) {
      const parsed = JSON.parse(decoded);
      if (parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: normalizePrivateKey(parsed.private_key),
        };
      }
    }
  } catch {}

  // 2. Try raw JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: normalizePrivateKey(parsed.private_key),
        };
      }
    } catch {}
  }

  // 3. Fallback PEM
  return {
    privateKey: normalizePrivateKey(trimmed),
  };
}

console.log('--- Test 1: Key Normalizer ---');
// Test literal \n
const escapedPem = '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\\n-----END PRIVATE KEY-----\\n';
const normalized1 = parseServiceAccountKey(escapedPem);
assert(normalized1.privateKey.includes('\n'), 'Should replace \\n with real newline');
assert(!normalized1.privateKey.includes('\\n'), 'Should not contain literal \\n');

// Test base64 JSON
const jsonPayload = JSON.stringify({
  client_email: 'test-sa@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----',
});
const base64Json = Buffer.from(jsonPayload).toString('base64');
const normalized2 = parseServiceAccountKey(base64Json);
assert.strictEqual(normalized2.clientEmail, 'test-sa@project.iam.gserviceaccount.com');
assert(normalized2.privateKey.includes('-----BEGIN PRIVATE KEY-----'));

// Test raw JSON
const normalized3 = parseServiceAccountKey(jsonPayload);
assert.strictEqual(normalized3.clientEmail, 'test-sa@project.iam.gserviceaccount.com');
assert(normalized3.privateKey.includes('-----BEGIN PRIVATE KEY-----'));
console.log('✔ Key Normalizer tests passed.');

// 2. Test Filename Sanitization
function sanitizeFilename(name, fallback = 'file') {
  const clean = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || fallback;
}

console.log('--- Test 2: Filename Sanitizer ---');
assert.strictEqual(sanitizeFilename('../../../etc/passwd.pdf'), '.._.._.._etc_passwd.pdf');
assert.strictEqual(sanitizeFilename('bad:name*with?chars.png'), 'bad_name_with_chars.png');
assert.strictEqual(sanitizeFilename('   clean   name   .pptx'), 'clean name .pptx');
assert.strictEqual(sanitizeFilename(''), 'file');
console.log('✔ Filename Sanitizer tests passed.');

// 3. Test In-Memory Sliding Window Rate Limiter
console.log('--- Test 3: Rate Limiter ---');
const rateLimitStore = new Map();
function checkRateLimit(key, limit = 5, windowMs = 1000) {
  const now = Date.now();
  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
  if (record.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }
  record.timestamps.push(now);
  return { allowed: true, remaining: limit - record.timestamps.length };
}

for (let i = 0; i < 5; i++) {
  const r = checkRateLimit('user1', 5, 1000);
  assert(r.allowed, `Request ${i} should be allowed`);
}
const blocked = checkRateLimit('user1', 5, 1000);
assert(!blocked.allowed, 'Request 6 should be blocked by rate limiter');
console.log('✔ Rate Limiter tests passed.');

// 4. Role Hierarchy Check
console.log('--- Test 4: Role Boundaries ---');
function canAccessRejected(role) {
  return role === 'super_admin';
}
function canApproveOrReject(role) {
  return role === 'admin' || role === 'super_admin';
}

assert.strictEqual(canAccessRejected('admin'), false, 'Regular admin must NOT access Rejected folder');
assert.strictEqual(canAccessRejected('super_admin'), true, 'Super admin MUST access Rejected folder');
assert.strictEqual(canApproveOrReject('admin'), true, 'Admin can approve/reject');
assert.strictEqual(canApproveOrReject('super_admin'), true, 'Super admin can approve/reject');
assert.strictEqual(canApproveOrReject('attendee'), false, 'Attendee cannot approve/reject');
console.log('✔ Role Boundaries tests passed.');

console.log('\nAll Drive Approval Logic tests PASSED cleanly!');
