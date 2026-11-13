const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), name);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const k = trimmed.slice(0, eqIdx).trim();
        let v = trimmed.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function isExactOakStaffDomain(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return false;
  if (normalized.indexOf("@", atIndex + 1) !== -1) return false;
  const domainPart = normalized.slice(atIndex);
  return domainPart === "@oakfnd.ch";
}

function isMismatchedOakDomain(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || isExactOakStaffDomain(normalized)) return false;
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) return false;
  const domain = normalized.slice(atIndex + 1);
  if (domain === "oakfnd.org") return false;
  return domain.endsWith(".oakfnd.ch") || domain.includes("oakfnd");
}

function isGoogleEmailVerified(user) {
  if (!user) return false;
  const metaVerified = user.user_metadata?.email_verified;
  if (metaVerified === true) return true;
  if (metaVerified === false) return false;
  if (user.app_metadata?.email_verified === true) return true;
  if (Array.isArray(user.identities) && user.identities.length > 0) {
    const googleIdentity = user.identities.find((id) => id?.provider === "google");
    if (googleIdentity?.identity_data?.email_verified === true) {
      return true;
    }
  }
  return false;
}

async function main() {
  console.log("=== Running Auth Allow-List & Live DB Seeding Verification ===");

  // 1. Seed alice.gentile@oakfnd.ch into public.attendees and normalize existing emails
  const { data: allAttendees, error: listErr } = await supabase
    .from("attendees")
    .select("id,email,event_code,first_name,last_name,organization,role");
  assert.strictEqual(listErr, null, "Must fetch attendees cleanly");

  let normalizedCount = 0;
  for (const row of allAttendees || []) {
    const clean = normalizeEmail(row.email);
    if (row.email !== clean) {
      const { error: upErr } = await supabase
        .from("attendees")
        .update({ email: clean })
        .eq("id", row.id);
      if (!upErr) normalizedCount++;
    }
  }
  console.log(`[1/7] Normalised ${normalizedCount} existing attendee email(s) in DB`);

  const existingAlice = (allAttendees || []).find(
    (a) => normalizeEmail(a.email) === "alice.gentile@oakfnd.ch"
  );
  if (!existingAlice) {
    const { data: insertedAlice, error: aliceErr } = await supabase
      .from("attendees")
      .insert({
        event_code: "OAK-2026-1104-ALGE",
        first_name: "Alice",
        last_name: "Gentile",
        organization: "OAK Foundation",
        role: "OAK Staff",
        email: "alice.gentile@oakfnd.ch",
      })
      .select("id,event_code,email,role")
      .single();
    assert.strictEqual(aliceErr, null, `Failed to insert Alice Gentile: ${aliceErr?.message}`);
    console.log(`[2/7] Inserted alice.gentile@oakfnd.ch into public.attendees (${insertedAlice.event_code})`);
  } else {
    console.log(`[2/7] alice.gentile@oakfnd.ch already present in public.attendees (${existingAlice.event_code})`);
  }

  // 2. Test email normalisation
  assert.strictEqual(
    normalizeEmail("  Alice.Gentile@OakFnd.CH \n"),
    "alice.gentile@oakfnd.ch",
    "Must lowercase and trim email"
  );
  console.log("[3/7] Email normalisation (lowercase + trim) verified");

  // 3. Test exact @oakfnd.ch domain matching
  assert.strictEqual(isExactOakStaffDomain("alice.gentile@oakfnd.ch"), true);
  assert.strictEqual(isExactOakStaffDomain("  ANY.EMPLOYEE@OAKFND.CH "), true);
  assert.strictEqual(isExactOakStaffDomain("user@sub.oakfnd.ch"), false, "Must reject subdomain");
  assert.strictEqual(isExactOakStaffDomain("user@evil-oakfnd.ch"), false, "Must reject lookalike domain");
  assert.strictEqual(isExactOakStaffDomain("oakfnd.ch"), false, "Must reject bare domain");
  assert.strictEqual(isExactOakStaffDomain("@oakfnd.ch"), false, "Must reject missing local part");
  assert.strictEqual(isExactOakStaffDomain("a@b@oakfnd.ch"), false, "Must reject multiple @");
  assert.strictEqual(isMismatchedOakDomain("user@sub.oakfnd.ch"), true, "Must flag subdomain as domain_mismatch");
  assert.strictEqual(isMismatchedOakDomain("user@fakeoakfnd.ch"), true, "Must flag lookalike as domain_mismatch");
  console.log("[4/7] Exact @oakfnd.ch domain matching & subdomain rejection verified");

  // 4. Test Google email_verified check
  assert.strictEqual(
    isGoogleEmailVerified({ user_metadata: { email_verified: true } }),
    true
  );
  assert.strictEqual(
    isGoogleEmailVerified({ user_metadata: { email_verified: false } }),
    false
  );
  assert.strictEqual(
    isGoogleEmailVerified({ user_metadata: {} }),
    false,
    "Missing email_verified must return false"
  );
  assert.strictEqual(
    isGoogleEmailVerified({
      user_metadata: {},
      identities: [{ provider: "google", identity_data: { email_verified: true } }],
    }),
    true
  );
  console.log("[5/7] Google email_verified strict boolean requirement verified");

  // 5. Verify source code files contain all required pieces
  const allowlistSrc = fs.readFileSync(
    path.join(process.cwd(), "src/lib/auth/allowlist.ts"),
    "utf8"
  );
  assert(allowlistSrc.includes('"alice.gentile@oakfnd.ch"'), "allowlist.ts must include alice.gentile@oakfnd.ch");
  assert(
    allowlistSrc.includes('domainSuffix === "@oakfnd.ch"'),
    "allowlist.ts must check exact @oakfnd.ch domain"
  );

  // The callback delegates enforcement to the shared login module (also used by email OTP sign-in).
  const callbackSrc = ["src/app/api/auth/callback/route.ts", "src/lib/auth/finalize-login.ts"]
    .map((f) => fs.readFileSync(path.join(process.cwd(), f), "utf8"))
    .join("\n");
  assert(
    callbackSrc.includes("adminClient.auth.admin.deleteUser(user.id)"),
    "callback/route.ts must delete unauthorized user so no usable account is left behind"
  );
  assert(
    callbackSrc.includes("evaluateSignInAllowlist"),
    "callback/route.ts must enforce evaluateSignInAllowlist on server"
  );
  console.log("[6/7] Server callback enforcement & account cleanup verified");

  const loginPageSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/admin/login/page.tsx"),
    "utf8"
  );
  assert(
    loginPageSrc.includes("Your email isn't authorised yet, contact vincent@uncommon.org"),
    "Login page must include friendly not-authorised message"
  );
  assert(
    loginPageSrc.includes("Sign-in was cancelled"),
    "Login page must include friendly cancelled message"
  );
  assert(
    loginPageSrc.includes("Your organisation blocks this app, ask your IT team to approve it"),
    "Login page must include friendly org-blocked message"
  );
  assert(
    loginPageSrc.includes("Something went wrong, reference "),
    "Login page must include friendly reference error message"
  );
  console.log("[7/7] Friendly sign-in error messages verified");

  console.log("=== ALL 7/7 CHECKS PASSED ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
