# Registration security setup

“Registration is temporarily unavailable” means REGISTRATION_RPC_SECRET (minimum
32 characters), NEXT_PUBLIC_SUPABASE_URL, or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing
from the running deployment. Public registration deliberately fails closed.

1. Run `node scripts/prepare-registration.mjs` from the repository root. It creates
   a random secret in the ignored .env file (or .env.local if present). Existing
   valid secrets are reused. The secret is never printed.
2. Run `supabase/registration-setup.local.sql` in Supabase SQL Editor. This applies
   the security migration and configures the matching hash in one transaction.
   It can be rerun. Do not rerun schema.sql over these tightened policies.
3. Add REGISTRATION_RPC_SECRET in Vercel → project → Settings → Environment
   Variables → Production, using the exact value from the local environment file.
   Vercel needs the original secret, not the hash. Never use a NEXT_PUBLIC_ prefix.
4. Check that the Supabase URL and public key belong to the project where the SQL
   was run. Redeploy and test a new registration and authenticated staff check-in.

Changing the secret requires updating both Vercel and the Supabase hash. Do not
commit environment files or share the secret in chat or screenshots.

The RPC uses the public key, validates inputs, and allows 10 attempts per IP and
3 per email per 15 minutes, atomically across app instances. Outside Vercel,
untrusted forwarded headers are ignored and a shared rate bucket is used. Review
the IP limit for venues where many legitimate attendees share one network.

Staff APIs and RLS require a verified @uncommon.org user. Choosing the OAK Staff
registration role does not grant access. Auth cookies are HttpOnly, Secure and
SameSite=Lax; OAuth and logout run on the server. The pass bookmark is not an
authorization credential. Public passes omit private attendee details.

Verification: `node scripts/verify-backend.mjs`,
`node --test scripts/security.test.cjs`, and `npx tsc --noEmit`.
Security tests mock Supabase; live SQL and OAuth testing is still required.
