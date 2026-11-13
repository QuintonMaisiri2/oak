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
const adminUsers = load('src/lib/auth/admin-users.ts');
const audit = load('src/lib/audit.ts');

const EXPECTED_SEEDED_EMAILS = [
  'tapiwa.chikwanha@uncommon.org',
  'walter@uncommon.org',
  'michelle.gwatiringa@uncommon.org',
  'tanatswa@uncommon.org',
  'kirsty@uncommon.org',
  'vincent@uncommon.org',
  'farayi@uncommon.org',
  'elisha.urombo@uncommon.org',
  'beyond@uncommon.org',
  'comms@uncommon.org',
  'karl.riber@oakfnd.org',
  'adriana.craciun@oakfnd.ch',
  'merciful.machuwe@oakfnd.org',
  'cheryl.chang@oakfnd.ch',
  'silvia.guizzardi@oakfnd.ch',
];

test('1. Each seeded email is present, active, and qualifies as staff', () => {
  for (const email of EXPECTED_SEEDED_EMAILS) {
    const isDomainOk = policy.isValidAdminEmailDomain(email);
    assert.equal(isDomainOk, true, `Domain should be valid for ${email}`);

    const isStaff = policy.isStaffUser({
      email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
    });
    assert.equal(isStaff, true, `isStaffUser should be true for seeded email: ${email}`);
  }
});

test('2. Role Verification: Tapiwa is role=admin, Vincent is role=super_admin, others are admin', () => {
  const tapiwa = adminUsers.getSeededAdmin('tapiwa.chikwanha@uncommon.org');
  assert.equal(tapiwa?.role, 'admin', 'Tapiwa Chikwanha MUST have role=admin');
  assert.equal(tapiwa?.full_name, 'Tapiwa Chikwanha');
  assert.equal(tapiwa?.is_active, true);

  const superAdminEmail = adminUsers.getSuperAdminEmail();
  const superAdmin = adminUsers.getSeededAdmin(superAdminEmail);
  assert.equal(superAdmin?.role, 'super_admin', `${superAdminEmail} MUST have role=super_admin`);
  assert.equal(superAdmin?.is_active, true);

  // All other seeded admins must be role=admin
  for (const email of EXPECTED_SEEDED_EMAILS) {
    if (email === superAdminEmail) continue;
    const admin = adminUsers.getSeededAdmin(email);
    assert.equal(admin?.role, 'admin', `${email} must have role=admin`);
    assert.equal(admin?.is_active, true, `${email} must be active`);
  }
});

test('3. Non-listed accounts from allowed domains are denied', () => {
  const deniedEmails = [
    'random.staff@oakfnd.org',
    'another.person@oakfnd.ch',
    'unknown.intern@uncommon.org',
    'intruder@uncommon.org',
  ];

  for (const email of deniedEmails) {
    assert.equal(policy.isValidAdminEmailDomain(email), true);
    const isStaff = policy.isStaffUser({
      email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
    });
    assert.equal(isStaff, false, `Non-listed email ${email} MUST be denied access`);
  }
});

test('4. Personal Gmail and lookalike domains are strictly rejected', () => {
  const forbidden = [
    'user@gmail.com',
    'admin@yahoo.com',
    'tapiwa.chikwanha@uncommon.org.evil.com',
    'admin@oakfnd.org.attacker.io',
    'silvia.guizzardi@sub.oakfnd.ch',
    'attacker@sub.uncommon.org',
    'karl.riber@oakfnd.co',
  ];

  for (const email of forbidden) {
    assert.equal(policy.isValidAdminEmailDomain(email), false, `Lookalike/Personal ${email} must be rejected`);
    assert.equal(
      policy.isStaffUser({
        email,
        email_confirmed_at: '2026-01-01T00:00:00Z',
      }),
      false
    );
  }
});

test('5. Unverified provider accounts are denied even if email is allowlisted', () => {
  const unconfirmedUser = {
    email: 'tapiwa.chikwanha@uncommon.org',
    email_confirmed_at: null,
    user_metadata: { email_verified: false },
  };
  assert.equal(policy.isStaffUser(unconfirmedUser), false);
});

test('6. Shared or role-based mailboxes are flagged (e.g. comms@uncommon.org)', () => {
  assert.equal(adminUsers.isSharedMailbox('comms@uncommon.org'), true);
  assert.equal(adminUsers.isSharedMailbox('info@oakfnd.org'), true);
  assert.equal(adminUsers.isSharedMailbox('contact@oakfnd.ch'), true);
  assert.equal(adminUsers.isSharedMailbox('tapiwa.chikwanha@uncommon.org'), false);
  assert.equal(adminUsers.isSharedMailbox('vincent@uncommon.org'), false);
});

test('7. Super admin safeguards: cannot self-demote, self-deactivate, or self-remove', async () => {
  const superEmail = adminUsers.getSuperAdminEmail();

  // Self-demotion rejected
  await assert.rejects(
    async () => {
      await adminUsers.updateAdminUserRole(superEmail, 'admin', superEmail);
    },
    /Security restriction: A super administrator cannot demote their own account/
  );

  // Self-deactivation rejected
  await assert.rejects(
    async () => {
      await adminUsers.updateAdminUserStatus(superEmail, false, superEmail);
    },
    /Security restriction: You cannot deactivate your own super administrator account/
  );

  // Self-removal rejected
  await assert.rejects(
    async () => {
      await adminUsers.deleteAdminUser(superEmail, superEmail);
    },
    /Security restriction: You cannot remove your own super administrator account/
  );
});

test('8. Safeguard: Minimum 1 active super admin must always exist', async () => {
  const superEmail = adminUsers.getSuperAdminEmail();
  const actor = 'another.actor@uncommon.org';

  // Attempting to demote the only super admin
  await assert.rejects(
    async () => {
      await adminUsers.updateAdminUserRole(superEmail, 'admin', actor);
    },
    /There must always be at least one active super administrator/
  );

  // Attempting to deactivate the only super admin
  await assert.rejects(
    async () => {
      await adminUsers.updateAdminUserStatus(superEmail, false, actor);
    },
    /There must always be at least one active super administrator/
  );

  // Attempting to remove the only super admin
  await assert.rejects(
    async () => {
      await adminUsers.deleteAdminUser(superEmail, actor);
    },
    /There must always be at least one active super administrator/
  );
});

test('9. Team and Activity APIs enforce 403 Forbidden for Tapiwa (role=admin) and allow super_admin', async () => {
  // Tapiwa's auth context (role = admin)
  const tapiwaMockAuth = {
    client: {},
    user: { email: 'tapiwa.chikwanha@uncommon.org' },
    adminUser: {
      email: 'tapiwa.chikwanha@uncommon.org',
      role: 'admin',
      team: 'Coordination Team',
      is_active: true,
    },
  };

  // Super admin auth context
  const superMockAuth = {
    client: {},
    user: { email: 'vincent@uncommon.org' },
    adminUser: {
      email: 'vincent@uncommon.org',
      role: 'super_admin',
      team: 'Coordination Team',
      is_active: true,
    },
  };

  // Tapiwa accessing Team route -> 403
  const teamRouteForTapiwa = load('src/app/api/admin/team/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => ({
        response: NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 }),
      }),
    },
    '@/lib/auth/admin-users': adminUsers,
    '@/lib/auth/policy': policy,
    '@/lib/audit': audit,
  });

  const tapiwaTeamRes = await teamRouteForTapiwa.GET();
  assert.equal(tapiwaTeamRes.status, 403, 'Tapiwa must be denied with 403 on Team API');

  // Tapiwa accessing Activity route -> 403
  const activityRouteForTapiwa = load('src/app/api/admin/activity/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => ({
        response: NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 }),
      }),
    },
    '@/lib/audit': audit,
  });

  const tapiwaActivityRes = await activityRouteForTapiwa.GET(new NextRequest('https://oak.test/api/admin/activity'));
  assert.equal(tapiwaActivityRes.status, 403, 'Tapiwa must be denied with 403 on Activity API');

  // Tapiwa accessing Email-test route -> 403
  const emailTestRouteForTapiwa = load('src/app/api/admin/email-test/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => ({
        response: NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 }),
      }),
    },
    '@/lib/email': {
      getEmailConfigStatus: () => ({ provider: 'smtp', isConfigured: true, vars: {}, missingVars: [], fromEmail: 'test@uncommon.org' }),
      verifySmtpConnection: async () => ({ success: true, message: 'OK' }),
    },
  });

  const tapiwaEmailTestRes = await emailTestRouteForTapiwa.GET(new NextRequest('https://oak.test/api/admin/email-test'));
  assert.equal(tapiwaEmailTestRes.status, 403, 'Tapiwa must be denied with 403 on Email-test API');

  // Super admin accessing Team route -> 200
  const teamRouteForSuper = load('src/app/api/admin/team/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => superMockAuth,
    },
    '@/lib/auth/admin-users': adminUsers,
    '@/lib/auth/policy': policy,
    '@/lib/audit': audit,
  });

  const superTeamRes = await teamRouteForSuper.GET();
  assert.equal(superTeamRes.status, 200, 'Super admin must receive 200 on Team API');
  const teamData = await superTeamRes.json();
  assert.ok(Array.isArray(teamData.admins), 'Should return list of admins');

  // Super admin accessing Activity route -> 200
  const activityRouteForSuper = load('src/app/api/admin/activity/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => superMockAuth,
    },
    '@/lib/audit': audit,
  });

  const superActivityRes = await activityRouteForSuper.GET(new NextRequest('https://oak.test/api/admin/activity'));
  assert.equal(superActivityRes.status, 200, 'Super admin must receive 200 on Activity API');
  const activityData = await superActivityRes.json();
  assert.ok(Array.isArray(activityData.logs), 'Should return audit logs');

  // Super admin accessing Email-test route -> 200
  const emailTestRouteForSuper = load('src/app/api/admin/email-test/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => superMockAuth,
    },
    '@/lib/email': {
      getEmailConfigStatus: () => ({ provider: 'smtp', isConfigured: true, vars: {}, missingVars: [], fromEmail: 'test@uncommon.org' }),
      verifySmtpConnection: async () => ({ success: true, message: 'OK' }),
    },
  });

  const superEmailTestRes = await emailTestRouteForSuper.GET(new NextRequest('https://oak.test/api/admin/email-test'));
  assert.equal(superEmailTestRes.status, 200, 'Super admin must receive 200 on Email-test API');
  const emailTestData = await superEmailTestRes.json();
  assert.equal(emailTestData.isConfigured, true);
});

test('10. Role change records audit log entry', async () => {
  // Test logging role change
  await audit.logAuditEvent({
    action: 'admin_role_changed',
    actor_email: 'vincent@uncommon.org',
    target_email: 'walter@uncommon.org',
    details: {
      old_role: 'admin',
      new_role: 'super_admin',
    },
  });

  const logs = await audit.listAuditLogs(10);
  const found = logs.find(
    (l) => l.action === 'admin_role_changed' && l.target_email === 'walter@uncommon.org'
  );
  assert.ok(found, 'Role change audit log entry must be present');
  assert.equal(found?.actor_email, 'vincent@uncommon.org');
  assert.equal(found?.details?.new_role, 'super_admin');
});

test('11. Idempotency: Duplicate seed list has unique lowercase emails', () => {
  const list = adminUsers.listAdminUsers();
  // listAdminUsers is async in implementation, check promise or sync seeded admins
  const seeds = adminUsers.SEEDED_ADMIN_USERS;
  const emails = seeds.map(s => s.email.toLowerCase().trim());
  const uniqueEmails = new Set(emails);
  assert.equal(emails.length, uniqueEmails.size, 'Seeded admin list must not contain duplicate emails');
});

test('12. Attendee Deletion: Super admin can delete registered user, regular admin gets 403', async () => {
  const sampleAttendee = {
    id: 'a0000000-0000-4000-a000-000000000001',
    event_code: 'OAK-2026-1234-ABCD',
    first_name: 'Test',
    last_name: 'Attendee',
    name: 'Test Attendee',
    organization: 'Test Org',
    role: 'Grantee',
    email: 'test.attendee@example.org',
  };

  let db = [ { ...sampleAttendee } ];

  const createMockAdminClient = () => ({
    from: (table) => {
      let selectedCol = '';
      let filterCol = '';
      let filterVal = '';
      return {
        select: (cols) => {
          selectedCol = cols;
          return {
            eq: (col, val) => {
              filterCol = col;
              filterVal = val;
              return {
                maybeSingle: async () => {
                  const match = db.find(
                    (a) =>
                      String(a[filterCol]).toLowerCase() === String(filterVal).toLowerCase()
                  );
                  return { data: match ? { ...match } : null, error: null };
                },
              };
            },
          };
        },
        delete: () => ({
          eq: async (col, val) => {
            if (table === 'attendees') {
              db = db.filter((a) => a[col] !== val);
            }
            return { error: null };
          },
        }),
      };
    },
  });

  // Regular admin (e.g. Tapiwa / role = admin) attempts to delete -> 403 Forbidden
  const deleteRouteForRegularAdmin = load('src/app/api/attendees/[id]/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => ({
        response: NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 }),
      }),
    },
    '@/lib/supabase/server': {
      createAdminClient: createMockAdminClient,
      createClient: async () => ({}),
      isSupabaseServerConfigured: () => true,
    },
    '@/lib/audit': audit,
  });

  const req403 = new NextRequest('https://oak.test/api/attendees/' + sampleAttendee.id, { method: 'DELETE' });
  const res403 = await deleteRouteForRegularAdmin.DELETE(req403, { params: Promise.resolve({ id: sampleAttendee.id }) });
  assert.equal(res403.status, 403, 'Regular admin must be denied with 403 Forbidden');
  assert.equal(db.length, 1, 'Attendee must not have been deleted from DB');

  // Super admin attempts to delete with invalid ID -> 400
  const deleteRouteForSuperAdmin = load('src/app/api/attendees/[id]/route.ts', {
    '@/lib/auth/server': {
      requireSuperAdmin: async () => ({
        user: { email: 'vincent@uncommon.org' },
        adminUser: { email: 'vincent@uncommon.org', role: 'super_admin' },
      }),
    },
    '@/lib/supabase/server': {
      createAdminClient: createMockAdminClient,
      createClient: async () => ({}),
      isSupabaseServerConfigured: () => true,
    },
    '@/lib/audit': audit,
  });

  const req400 = new NextRequest('https://oak.test/api/attendees/invalid--id', { method: 'DELETE' });
  const res400 = await deleteRouteForSuperAdmin.DELETE(req400, { params: Promise.resolve({ id: 'invalid--id' }) });
  assert.equal(res400.status, 400, 'Invalid ID must return 400 Bad Request');

  // Super admin deletes existing attendee by UUID -> 200
  const req200 = new NextRequest('https://oak.test/api/attendees/' + sampleAttendee.id, { method: 'DELETE' });
  const res200 = await deleteRouteForSuperAdmin.DELETE(req200, { params: Promise.resolve({ id: sampleAttendee.id }) });
  assert.equal(res200.status, 200, 'Super admin deletion should succeed with 200');
  const body200 = await res200.json();
  assert.equal(body200.success, true);
  assert.equal(body200.deletedId, sampleAttendee.id);
  assert.equal(db.length, 0, 'Attendee should be removed from database');

  // Verify audit log has attendee_deleted entry
  const logs = await audit.listAuditLogs(10);
  const deleteLog = logs.find((l) => l.action === 'attendee_deleted' && l.target_email === sampleAttendee.email);
  assert.ok(deleteLog, 'Audit log entry for attendee_deleted must exist');
  assert.equal(deleteLog.actor_email, 'vincent@uncommon.org');
  assert.equal(deleteLog.details?.attendee_id, sampleAttendee.id);
  assert.equal(deleteLog.details?.event_code, sampleAttendee.event_code);

  // Super admin deletes non-existent attendee -> 404
  const req404 = new NextRequest('https://oak.test/api/attendees/' + sampleAttendee.id, { method: 'DELETE' });
  const res404 = await deleteRouteForSuperAdmin.DELETE(req404, { params: Promise.resolve({ id: sampleAttendee.id }) });
  assert.equal(res404.status, 404, 'Deleting non-existent attendee must return 404 Not Found');

  // Super admin deletes by event_code
  db = [ { ...sampleAttendee } ];
  const reqCode = new NextRequest('https://oak.test/api/attendees/' + sampleAttendee.event_code, { method: 'DELETE' });
  const resCode = await deleteRouteForSuperAdmin.DELETE(reqCode, { params: Promise.resolve({ id: sampleAttendee.event_code }) });
  assert.equal(resCode.status, 200, 'Deleting attendee by event code should succeed with 200');
  assert.equal(db.length, 0, 'Attendee should be deleted when identified by event code');
});
