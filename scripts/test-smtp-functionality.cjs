const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const nodePath = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(filePath) {
  const absPath = nodePath.resolve(filePath);
  const code = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => {
      if (name === './ics') return { generateIcsContent: () => 'BEGIN:VCALENDAR\nEND:VCALENDAR' };
      if (name.startsWith('./') || name.startsWith('../')) {
        return load(nodePath.resolve(nodePath.dirname(absPath), name) + '.ts');
      }
      return require(name);
    },
    console, process,
    URL, Request, Response, Headers, AbortSignal, crypto, setTimeout, clearTimeout, Buffer
  }, { filename: absPath });
  return module.exports;
}

const emailLib = load('src/lib/email.ts');

test('1. resolveSmtpFromAddress ensures From matches SMTP_USER while preserving display name', () => {
  // Case A: Matching address
  const resA = emailLib.resolveSmtpFromAddress('OAK Clinics <bookings@uncommon.org>', 'bookings@uncommon.org');
  assert.equal(resA, 'OAK Clinics <bookings@uncommon.org>');

  // Case B: Mismatched address falls back to SMTP_USER with display name
  const resB = emailLib.resolveSmtpFromAddress('OAK Clinics <bookings@yourverifieddomain.com>', 'bookings@uncommon.org');
  assert.equal(resB, '"OAK Clinics" <bookings@uncommon.org>');

  // Case C: Plain email address without display name
  const resC = emailLib.resolveSmtpFromAddress('admin@other.com', 'bookings@uncommon.org');
  assert.equal(resC, 'bookings@uncommon.org');
});

test('2. formatSmtpError translates common SMTP error codes into actionable messages', () => {
  // Code 535 Bad Credentials
  const err535 = emailLib.formatSmtpError({ responseCode: 535, message: '535 5.7.8 Username and Password not accepted' });
  assert.ok(err535.includes('SMTP Authentication Failed (Code 535)'));
  assert.ok(err535.includes('App Password'));
  assert.ok(err535.includes('alias'));

  // Timeout
  const errTimeout = emailLib.formatSmtpError({ code: 'ETIMEDOUT', message: 'Connection timeout' });
  assert.ok(errTimeout.includes('SMTP Connection Timeout'));

  // Connection Refused
  const errRefused = emailLib.formatSmtpError({ code: 'ECONNREFUSED', message: 'Connection refused' });
  assert.ok(errRefused.includes('SMTP Connection Refused'));
});

test('3. isTemporaryFailure skips retrying on authentication errors and retries on timeouts', () => {
  // Permanent: 535
  assert.equal(
    emailLib.isTemporaryFailure({ success: false, provider: 'smtp', error: 'SMTP Authentication Failed (Code 535): Username and password not accepted' }),
    false,
    '535 auth errors should NEVER be retried'
  );

  // Permanent: Missing env vars
  assert.equal(
    emailLib.isTemporaryFailure({ success: false, provider: 'smtp', error: 'Missing required environment variable(s): SMTP_PASS' }),
    false,
    'Missing config errors should not be retried'
  );

  // Temporary: Timeout
  assert.equal(
    emailLib.isTemporaryFailure({ success: false, provider: 'smtp', error: 'SMTP Connection Timeout: Connection to smtp.gmail.com:465 timed out' }),
    true,
    'Timeouts should be retried'
  );

  // Temporary: 450 Busy
  assert.equal(
    emailLib.isTemporaryFailure({ success: false, provider: 'smtp', error: 'SMTP Error: 450 Mailbox busy, try again later' }),
    true,
    '4xx temporary errors should be retried'
  );
});

test('4. getEmailConfigStatus checks all required SMTP environment variables', () => {
  const oldEnv = { ...process.env };
  try {
    process.env.EMAIL_PROVIDER = 'smtp';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;

    const status = emailLib.getEmailConfigStatus();
    assert.equal(status.provider, 'smtp');
    assert.equal(status.isConfigured, false);
    assert.ok(status.missingVars.includes('SMTP_HOST'));
    assert.ok(status.missingVars.includes('SMTP_PORT'));
    assert.ok(status.missingVars.includes('SMTP_USER'));
    assert.ok(status.missingVars.includes('SMTP_PASS'));
    assert.ok(status.missingVars.includes('EMAIL_FROM'));

    // Populate variables
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'bookings@uncommon.org';
    process.env.SMTP_PASS = 'abcd1234efgh5678';
    process.env.EMAIL_FROM = 'OAK Clinics <bookings@uncommon.org>';

    const readyStatus = emailLib.getEmailConfigStatus();
    assert.equal(readyStatus.isConfigured, true);
    assert.equal(readyStatus.missingVars.length, 0);
    assert.equal(readyStatus.fromEmail, 'OAK Clinics <bookings@uncommon.org>');
  } finally {
    process.env = oldEnv;
  }
});

test('5. Deliberately wrong credentials produce clear Code 535 error and is marked as non-retryable', () => {
  const fakeSmtpAuthError = {
    code: 'EAUTH',
    responseCode: 535,
    message: '535-5.7.8 Username and Password not accepted. For more information, go to 535 5.7.8 https://support.google.com/mail/?p=BadCredentials'
  };

  const translated = emailLib.formatSmtpError(fakeSmtpAuthError);
  assert.ok(translated.includes('SMTP Authentication Failed (Code 535)'), 'Must identify Code 535');
  assert.ok(translated.includes('Google App Password'), 'Must mention App Password');
  assert.ok(translated.includes('alias'), 'Must mention alias / Google Group restriction');

  const sendResult = {
    success: false,
    provider: 'smtp',
    error: translated
  };

  assert.equal(emailLib.isTemporaryFailure(sendResult), false, 'Auth failures must NOT be retried');
});

