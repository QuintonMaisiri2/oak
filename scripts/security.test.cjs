const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodePath = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');

const moduleCache = new Map();

function load(filePath, mocks = {}) {
  const absPath = nodePath.resolve(filePath);
  if (moduleCache.has(absPath) && Object.keys(mocks).length === 0) {
    return moduleCache.get(absPath);
  }
  const code = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  if (Object.keys(mocks).length === 0) {
    moduleCache.set(absPath, module.exports);
  }
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('./') || name.startsWith('../')) {
        const resolved = nodePath.resolve(nodePath.dirname(absPath), name);
        for (const ext of ['.ts', '.tsx', '.js', '.cjs', '/index.ts', '/index.js']) {
          if (fs.existsSync(resolved + ext)) return load(resolved + ext, mocks);
        }
      }
      if (name.startsWith('@/')) {
        const resolved = nodePath.resolve('src', name.slice(2));
        for (const ext of ['.ts', '.tsx', '.js', '.cjs', '/index.ts', '/index.js']) {
          if (fs.existsSync(resolved + ext)) return load(resolved + ext, mocks);
        }
      }
      return require(name);
    },
    console: { error() {}, warn() {}, log() {} }, process,
    URL, Request, Response, Headers, AbortSignal, crypto, setTimeout, clearTimeout,
  }, { filename: absPath });
  return module.exports;
}

const policy = load('src/lib/auth/policy.ts');
const passAccess = load('src/lib/auth/pass-access.ts');
const qr = load('src/lib/qr/index.ts');
const schemas = load('src/lib/validation/schemas.ts');
const staff = { id: 'staff-id', email: 'walter@uncommon.org', email_confirmed_at: '2026-01-01' };
const valid = { firstName: 'Test', lastName: 'Person', organization: 'Example', email: 'test@example.org', role: 'Partner', consent: true };

test('QR payload cap is enforced before JSON.parse, malformed JSON is rejected', () => {
  assert.equal(qr.parseScannedQrPayload(' '.repeat(2049) + '{"id":"ok"}'), '');
  assert.equal(qr.parseScannedQrPayload('{"id": /pass/OAK-2026-1234-TEST}'), '');
  assert.equal(qr.parseScannedQrPayload('{"id":123}'), '');
  assert.equal(qr.parseScannedQrPayload('{"id":"abc"}'), 'abc');
  assert.equal(qr.parseScannedQrPayload('https://example.org/pass/OAK-2026-1234-TEST'), 'OAK-2026-1234-TEST');
  assert.equal(qr.parseScannedQrPayload('x'.repeat(2048)), 'x'.repeat(2048));
});

test('registration rejects oversized fields, unknown keys and absent consent', () => {
  assert.equal(schemas.registrationSchema.safeParse(valid).success, true);
  for (const payload of [{ ...valid, firstName: 'x'.repeat(101) }, { ...valid, isAdmin: true }, { ...valid, consent: false }]) {
    assert.equal(schemas.registrationSchema.safeParse(payload).success, false);
  }
});

test('admin domain validation accepts only oakfnd.org, oakfnd.ch, uncommon.org and rejects lookalikes', () => {
  // Allowed domains exact matches
  assert.equal(policy.isValidAdminEmailDomain('tapiwa.chikwanha@uncommon.org'), true);
  assert.equal(policy.isValidAdminEmailDomain('karl.riber@oakfnd.org'), true);
  assert.equal(policy.isValidAdminEmailDomain('silvia.guizzardi@oakfnd.ch'), true);
  assert.equal(policy.isValidAdminEmailDomain('SILVIA.GUIZZARDI@OAKFND.CH'), true);

  // Lookalikes rejected
  assert.equal(policy.isValidAdminEmailDomain('attacker@oakfnd.org.evil.com'), false);
  assert.equal(policy.isValidAdminEmailDomain('attacker@sub.oakfnd.org'), false);
  assert.equal(policy.isValidAdminEmailDomain('attacker@oakfnd.co'), false);
  assert.equal(policy.isValidAdminEmailDomain('attacker@uncommon.org.evil.com'), false);
  assert.equal(policy.isValidAdminEmailDomain('attacker@gmail.com'), false);
  assert.equal(policy.isValidAdminEmailDomain(''), false);
  assert.equal(policy.isValidAdminEmailDomain(null), false);
});

test('only verified staff in admin allowlist qualify and redirects stay in admin paths', () => {
  // Seeded admin with confirmed email
  assert.equal(policy.isStaffUser(staff), true);
  // Unverified provider email rejected
  assert.equal(policy.isStaffUser({ ...staff, email_confirmed_at: null }), false);
  // Lookalike domain rejected
  assert.equal(policy.isStaffUser({ ...staff, email: 'walter@uncommon.org.attacker.com' }), false);
  // Email on allowed domain but NOT in admin allowlist rejected!
  assert.equal(policy.isStaffUser({ ...staff, email: 'nonseeded@uncommon.org' }), false);
  assert.equal(policy.isStaffUser({ ...staff, email: 'nonseeded@oakfnd.org' }), false);
  assert.equal(policy.isStaffUser({ ...staff, email: 'nonseeded@oakfnd.ch' }), false);

  // Other seeded admins pass
  assert.equal(policy.isStaffUser({ ...staff, email: 'karl.riber@oakfnd.org' }), true);
  assert.equal(policy.isStaffUser({ ...staff, email: 'silvia.guizzardi@oakfnd.ch' }), true);
  assert.equal(policy.isStaffUser({ ...staff, email: 'tapiwa.chikwanha@uncommon.org' }), true);

  for (const path of ['//evil.com', 'https://evil.com', '/admin/../../pass/foo', '/pass/foo', '/admin\\evil', '/admin?next=evil']) {
    assert.equal(policy.safeAdminPath(path), '/admin');
  }
  assert.equal(policy.safeAdminPath('/admin/scan'), '/admin/scan');
});

function accessFor(user) {
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) }, from() { throw new Error('Unexpected DB access'); } };
  return load('src/lib/auth/server.ts', {
    '@/lib/supabase/server': { createClient: async () => client, isSupabaseServerConfigured: () => true },
    './policy': policy,
    '@/lib/audit': { logAuditEvent: async () => {} },
  });
}

test('anonymous and non-staff requests are denied before private reads/writes', async () => {
  for (const [user, expected] of [[null, 401], [{ ...staff, email: 'outsider@example.org' }, 403]]) {
    const access = accessFor(user);
    const mocks = {
      '@/lib/auth/server': access,
      '@/lib/auth/policy': policy,
      '@/lib/validation/schemas': schemas,
      '@/lib/qr': qr,
      '@/lib/audit': { logAuditEvent: async () => {} },
    };
    const checkin = load('src/app/api/check-in/route.ts', mocks);
    const req = new NextRequest('https://oak.test/api/check-in', { method: 'POST', headers: { origin: 'https://oak.test', cookie: 'oak_admin_session=true; oak_role=OAK Staff' }, body: JSON.stringify({ code: 'OAK-2026-1234-TEST' }) });
    assert.equal((await checkin.POST(req)).status, expected);
    assert.equal((await checkin.GET(new NextRequest('https://oak.test/api/check-in'))).status, expected);
    const attendees = load('src/app/api/attendees/route.ts', mocks);
    assert.equal((await attendees.GET()).status, expected);
  }
});

test('cross-origin check-in requests do not even attempt authentication', async () => {
  const checkin = load('src/app/api/check-in/route.ts', {
    '@/lib/auth/server': { requireStaff() { throw new Error('Must not be called'); } },
    '@/lib/auth/policy': policy, '@/lib/validation/schemas': schemas, '@/lib/qr': qr,
  });
  assert.equal((await checkin.POST(new NextRequest('https://oak.test/api/check-in', { method: 'POST', headers: { origin: 'https://evil.test' } }))).status, 403);
});

test('staff check-in works; repeat scan does not insert again', async () => {
  let inserted = false, writes = 0;
  const attendee = { id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d', first_name: 'Test', last_name: 'Person', name: 'Test Person', organization: 'Example', role: 'Partner', event_code: 'OAK-2026-1234-TEST', created_at: '2026-01-01T00:00:00Z' };
  const record = { id: 'check', scanned_at: '2026-11-09T08:00:00Z', event_day: 'Day 1' };
  const client = { from(table) {
    let inserting = false, counting = false;
    const chain = {
      select(columns, opts) { counting = !!opts?.count; return chain; },
      eq() { return chain; },
      order() { return chain; },
      insert(value) { assert.equal(value.scanned_by_admin_id, staff.id); inserting = true; return chain; },
      async single() { assert.ok(inserting); inserted = true; writes++; return { data: record, error: null }; },
      async maybeSingle() { return { data: table === 'attendees' ? attendee : inserted ? record : null, error: null }; },
      then(resolve) { return Promise.resolve({ count: counting ? 1 : null, data: table === 'attendees' ? [attendee] : [] }).then(resolve); },
    };
    return chain;
  } };
  const checkin = load('src/app/api/check-in/route.ts', {
    '@/lib/auth/server': { requireStaff: async () => ({ client, user: staff }) },
    '@/lib/supabase/server': { createAdminClient: () => client },
    '@/lib/auth/policy': policy, '@/lib/validation/schemas': schemas, '@/lib/qr': qr,
  });
  const request = () => new NextRequest('https://oak.test/api/check-in', { method: 'POST', headers: { origin: 'https://oak.test' }, body: JSON.stringify({ code: attendee.event_code, eventDay: '2026-11-09' }) });
  const firstRes = await checkin.POST(request());
  const firstJson = await firstRes.json();
  assert.equal(firstJson.status, 'checked_in');

  const secondRes = await checkin.POST(request());
  const secondJson = await secondRes.json();
  assert.equal(secondJson.status, 'already_checked_in');
  assert.equal(writes, 1);
});

test('callback hides internal errors, validates repeated callbacks and clears legacy cookies securely', async () => {
  const callback = load('src/app/api/auth/callback/route.ts', {
    '@/lib/auth/policy': policy,
    '@/lib/qr': qr,
    '@/lib/audit': { logAuditEvent: async () => {} },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      exchangeCodeForSession: async () => ({ error: new Error('internal-sensitive-detail') }),
      getUser: async () => ({ data: { user: null }, error: new Error('internal-sensitive-detail') }),
    } }) },
  });
  const response = await callback.GET(new Request('https://oak.test/api/auth/callback?code=invalid'));
  assert.equal(response.headers.get('location'), 'https://oak.test/admin/login?error=auth-failed#');
  assert.ok(!response.headers.get('location').includes('internal-sensitive-detail'));
  const cookie = response.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=lax']) assert.ok(cookie.includes(flag));
});

test('server Supabase cookie writes always set HttpOnly, Secure and SameSite', async () => {
  let config, written;
  const server = load('src/lib/supabase/server.ts', {
    '@/lib/auth/policy': policy,
    '@supabase/ssr': { createServerClient: (url, key, options) => { config = options; return {}; } },
    'next/headers': { cookies: async () => ({ getAll: () => [], set: (...args) => { written = args; } }) },
  });
  await server.createClient();
  config.cookies.setAll([{ name: 'sb-auth-token', value: 'secret', options: { httpOnly: false, secure: false } }]);
  assert.equal(written[2].httpOnly, true);
  assert.equal(written[2].secure, true);
  assert.equal(written[2].sameSite, 'lax');
});

test('public registration uses anon RPC, handles rate limits and sets secure pass cookies', async () => {
  const prior = { secret: process.env.REGISTRATION_RPC_SECRET, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  Object.assign(process.env, { REGISTRATION_RPC_SECRET: 'x'.repeat(32), NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' });
  let result = { success: false, code: 'rate_limited' }, cookie;
  const action = load('src/app/(public)/register/actions.ts', {
    '@/lib/auth/pass-access': passAccess,
    'next/headers': { headers: async () => new Headers(), cookies: async () => ({ set: (...args) => { cookie = args; } }) },
    '@/lib/auth/policy': policy, '@/lib/qr': qr, '@/lib/validation/schemas': schemas,
    '@/lib/directory/server': { getPartners: async () => [] },
    '@supabase/supabase-js': { createClient: (url, key) => {
      assert.equal(key, 'anon-key');
      return { rpc: async (name, args) => {
        assert.equal(name, 'register_public_attendee');
        assert.match(args.p_rate_key, /^[a-f0-9]{64}$/);
        return { data: result, error: null };
      } };
    } },
  });
  try {
    const limited = await action.registerAttendee(valid);
    assert.equal(limited.success, false);
    assert.match(limited.error, /15 minutes/);
    assert.equal(cookie, undefined);
    result = { success: true, attendeeId: 'id', eventCode: 'OAK-2026-1234-TEST' };
    assert.equal((await action.registerAttendee(valid)).success, true);
    assert.equal(cookie[0], 'oak_partner_pass');
    assert.equal(cookie[2].httpOnly, true);
    assert.equal(cookie[2].secure, true);
  } finally {
    for (const [name, value] of Object.entries({ REGISTRATION_RPC_SECRET: prior.secret, NEXT_PUBLIC_SUPABASE_URL: prior.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: prior.key })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('pass email is restricted to signed-in owner or verified staff', async () => {
  const code = 'OAK-2026-1234-TEST';
  let currentUser = null;
  const attendee = { id: 'id', event_code: code, email: 'person@example.org', first_name: 'Test', last_name: 'Person' };

  const adminClient = {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: attendee, error: null }),
      };
      return chain;
    },
  };

  const route = load('src/app/api/attendees/[id]/route.ts', {
    '@/lib/auth/policy': policy,
    '@/lib/supabase/server': {
      isSupabaseServerConfigured: () => true,
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser }, error: null }) } }),
      createAdminClient: () => adminClient,
    },
  });

  // 1. Unauthenticated -> 401
  currentUser = null;
  const unauthRes = await route.GET(new NextRequest(`https://oak.test/api/attendees/${code}`), { params: Promise.resolve({ id: code }) });
  assert.equal(unauthRes.status, 401);

  // 2. Different non-staff user -> 403
  currentUser = { email: 'different@example.org', email_confirmed_at: '2026-01-01' };
  const forbiddenRes = await route.GET(new NextRequest(`https://oak.test/api/attendees/${code}`), { params: Promise.resolve({ id: code }) });
  assert.equal(forbiddenRes.status, 403);

  // 3. Ticket owner -> 200
  currentUser = { email: 'person@example.org', email_confirmed_at: '2026-01-01' };
  const ownerRes = await route.GET(new NextRequest(`https://oak.test/api/attendees/${code}`), { params: Promise.resolve({ id: code }) });
  assert.equal(ownerRes.status, 200);

  // 4. Staff member -> 200
  currentUser = { email: 'walter@uncommon.org', email_confirmed_at: '2026-01-01' };
  const staffRes = await route.GET(new NextRequest(`https://oak.test/api/attendees/${code}`), { params: Promise.resolve({ id: code }) });
  assert.equal(staffRes.status, 200);
});

test('programme docs require a session and reject cross-origin writes', async () => {
  const documentation = load('src/lib/programme/documentation.ts');
  const route = load('src/app/api/programme/docs/route.ts', {
    '@/lib/auth/server': accessFor(null), '@/lib/auth/policy': policy,
    '@/lib/programme/documentation': documentation,
  });
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.POST(new Request('https://oak.test/api/programme/docs', {
    method: 'POST', headers: { origin: 'https://oak.test' }, body: '{}',
  }))).status, 401);
  assert.equal((await route.POST(new Request('https://oak.test/api/programme/docs', {
    method: 'POST', headers: { origin: 'https://other.test' },
  }))).status, 403);
});

test('note schema validates required fields, optional pictures and reserved fields', () => {
  const { noteSchema } = load('src/lib/programme/documentation.ts');
  const valid = { author_org: 'Africa Ahead', day: 'Day 1', notes: 'Follow up with partners.' };
  assert.equal(noteSchema.safeParse(valid).success, true);
  assert.equal(noteSchema.safeParse({ ...valid, photo_urls: ['https://example.org/photo.jpg'] }).success, true);
  for (const extra of [
    { author_org: ' ' }, { author_org: 'x'.repeat(201) }, { day: 'Day 99' },
    { notes: ' ' }, { notes: 'x'.repeat(5001) },
    { photo_urls: ['not-a-url'] }, { photo_urls: ['http://example.org/photo.jpg'] },
    { photo_urls: ['javascript:alert(1)'] }, { photo_urls: ['https://user:password@example.org/photo.jpg'] },
    { photo_urls: ['https://example.org/one', 'https://example.org/two'] },
    { user_id: 'another-user' }, { author_name: 'Impersonated' }, { created_at: '2026-01-01' },
  ]) assert.equal(noteSchema.safeParse({ ...valid, ...extra }).success, false);
});

test('programme notes save optional photo and organization under the session owner', async () => {
  const documentation = load('src/lib/programme/documentation.ts');
  let inserted;
  const route = load('src/app/api/programme/docs/route.ts', {
    '@/lib/auth/server': { requireUser: async () => ({ user: { id: 'partner-id', email: 'partner@example.org', user_metadata: { full_name: 'Test Partner' } }, client: {
      from: () => ({ insert: value => { inserted = value; return { select: () => ({ single: async () => ({ data: { id: 'note-id', ...value }, error: null }) }) }; } }),
    } }) },
    '@/lib/auth/policy': policy, '@/lib/programme/documentation': documentation,
  });
  const send = body => route.POST(new Request('https://oak.test/api/programme/docs', {
    method: 'POST', headers: { origin: 'https://oak.test' }, body: JSON.stringify(body),
  }));
  assert.equal((await send({ day: 'Day 1', notes: 'Note' })).status, 400);
  assert.equal(inserted, undefined);
  const response = await send({ author_org: ' Africa Ahead ', day: 'Day 2', notes: '  Follow up with partners.  ', photo_urls: ['https://example.org/photo.jpg'] });
  assert.equal(response.status, 201);
  assert.equal(inserted.notes, 'Follow up with partners.');
  assert.equal(inserted.author_org, 'Africa Ahead');
  assert.equal(inserted.author_name, 'Test Partner');
  assert.equal(inserted.author_initials, 'TP');
  assert.equal(inserted.user_id, 'partner-id');
  assert.equal(inserted.photo_urls[0], 'https://example.org/photo.jpg');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('programme notes reads are scoped to the signed-in owner and return author defaults', async () => {
  let owner;
  const route = load('src/app/api/programme/docs/route.ts', {
    '@/lib/auth/server': { requireUser: async () => ({ user: { id: 'owner-id', email: 'person@example.org', user_metadata: { organization: 'Africa Ahead' } }, client: {
      from: () => ({ select() { return this; }, eq(field, value) { assert.equal(field, 'user_id'); owner = value; return this; }, order() { return this; }, limit: async () => ({ data: [], error: null }) }),
    } }) },
    '@/lib/auth/policy': policy, '@/lib/programme/documentation': load('src/lib/programme/documentation.ts'),
  });
  const response = await route.GET();
  const data = await response.json();
  assert.equal(owner, 'owner-id');
  assert.equal(data.author.name, 'person');
  assert.equal(data.author.organization, 'Africa Ahead');
});
