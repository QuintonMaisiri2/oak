import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Run from the repository root. Never print the secret or put it in tracked SQL.
const envPath = existsSync('.env.local') ? '.env.local' : '.env';
let contents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
let secret = parseEnv(contents).REGISTRATION_RPC_SECRET;
if (secret && (secret.length < 32 || secret.length > 512)) {
  throw new Error('Existing REGISTRATION_RPC_SECRET must be 32–512 characters; it has not been replaced.');
}
if (!secret) {
  secret = randomBytes(32).toString('hex');
  contents = contents.replace(/^\s*REGISTRATION_RPC_SECRET\s*=.*$/gm, '');
  writeFileSync(envPath, contents.trimEnd() + '\nREGISTRATION_RPC_SECRET=' + secret + '\n');
}
const hash = createHash('sha256').update(secret).digest('hex');
const migration = readFileSync('supabase/migrations/20260914_security_hardening.sql', 'utf8');
const configuration = `INSERT INTO private.registration_config (singleton, secret_hash)
VALUES (true, '${hash}')
ON CONFLICT (singleton) DO UPDATE SET secret_hash = EXCLUDED.secret_hash;\n`;
if (!/COMMIT;\s*$/.test(migration)) throw new Error('Expected a transactional migration.');
writeFileSync('supabase/registration-setup.local.sql', migration.replace(/COMMIT;\s*$/, configuration + 'COMMIT;\n'));
console.log('Prepared registration setup. No secrets printed.');
console.log('Run supabase/registration-setup.local.sql in Supabase SQL Editor.');
console.log(`Copy REGISTRATION_RPC_SECRET from ${envPath} into Vercel Production environment variables, then redeploy.`);
