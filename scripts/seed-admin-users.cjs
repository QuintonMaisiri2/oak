const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function loadEnv() {
  const env = {};
  if (fs.existsSync('.env')) {
    fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const designatedSuperAdmin = (env.SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || 'vincent@uncommon.org').toLowerCase().trim();

const SEEDED_ADMINS = [
  // Tapiwa Chikwanha - role is 'admin' (not super_admin)
  { email: 'tapiwa.chikwanha@uncommon.org', full_name: 'Tapiwa Chikwanha', role: 'admin', team: 'Coordination Team', is_active: true },
  
  // Uncommon (role admin), team: Coordination Team
  { email: 'walter@uncommon.org', full_name: 'Walter Gombarume', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'michelle.gwatiringa@uncommon.org', full_name: 'Michelle Gwatiringa', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'tanatswa@uncommon.org', full_name: 'Tanatswa Lionde', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'kirsty@uncommon.org', full_name: 'Kirsty Matyukira', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'vincent@uncommon.org', full_name: 'Vincent Mugondora', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'farayi@uncommon.org', full_name: 'Farayi Nyamayaro', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'elisha.urombo@uncommon.org', full_name: 'Elisha Urombo', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'beyond@uncommon.org', full_name: 'Beyond Bechani', role: 'admin', team: 'Coordination Team', is_active: true },
  { email: 'comms@uncommon.org', full_name: 'Oak Comms', role: 'admin', team: 'Coordination Team', is_active: true },

  // OAK (role admin), team: OAK
  { email: 'karl.riber@oakfnd.org', full_name: 'Karl Riber', role: 'admin', team: 'OAK', is_active: true },
  { email: 'adriana.craciun@oakfnd.ch', full_name: 'Adriana Craciun', role: 'admin', team: 'OAK', is_active: true },
  { email: 'merciful.machuwe@oakfnd.org', full_name: 'Merciful Machuwe', role: 'admin', team: 'OAK', is_active: true },
  { email: 'cheryl.chang@oakfnd.ch', full_name: 'Cheryl Chang', role: 'admin', team: 'OAK', is_active: true },
  { email: 'silvia.guizzardi@oakfnd.ch', full_name: 'Silvia Guizzardi', role: 'admin', team: 'OAK', is_active: true },
];

// Configure designated super admin
let hasSuperAdmin = false;
for (const admin of SEEDED_ADMINS) {
  if (admin.email === designatedSuperAdmin) {
    admin.role = 'super_admin';
    hasSuperAdmin = true;
  }
}
if (!hasSuperAdmin) {
  const isOak = designatedSuperAdmin.endsWith('@oakfnd.org') || designatedSuperAdmin.endsWith('@oakfnd.ch');
  SEEDED_ADMINS.unshift({
    email: designatedSuperAdmin,
    full_name: designatedSuperAdmin.split('@')[0].replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role: 'super_admin',
    team: isOak ? 'OAK' : 'Coordination Team',
    is_active: true,
  });
}

async function seed() {
  console.log("Seeding admin_users table...");
  const { data, error } = await supabase
    .from('admin_users')
    .upsert(
      SEEDED_ADMINS.map(a => ({
        ...a,
        email: a.email.toLowerCase().trim(),
        updated_at: new Date().toISOString()
      })),
      { onConflict: 'email' }
    )
    .select();

  if (error) {
    console.error("Failed to seed admin_users:", error.message);
    if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
      console.log("\nNOTE: The table 'public.admin_users' has not been created in Supabase yet.");
      console.log("Please run the migration at: supabase/migrations/20261103_admin_users_and_audit_logs.sql in the Supabase SQL editor.");
    }
  } else {
    console.log(`Successfully seeded ${data.length} admin users.`);
  }

  // Ensure Silvia's advisor email is correct
  const { data: advData, error: advErr } = await supabase
    .from('advisors')
    .update({ email: 'silvia.guizzardi@oakfnd.ch' })
    .eq('slug', 'silvia-guizzardi')
    .select();

  if (advErr) {
    console.warn("Could not update advisor email:", advErr.message);
  } else {
    console.log("Silvia Guizzardi's advisor email verified:", advData?.[0]?.email || 'ok');
  }
}

seed();
