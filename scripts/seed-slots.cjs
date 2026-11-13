const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const env = {};
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_SLOTS = [
  {
    start_time: '2026-11-09T17:10:00+02:00',
    end_time: '2026-11-09T17:40:00+02:00',
    duration_minutes: 30,
    note: null,
  },
  {
    start_time: '2026-11-09T17:40:00+02:00',
    end_time: '2026-11-09T18:10:00+02:00',
    duration_minutes: 30,
    note: null,
  },
  {
    start_time: '2026-11-10T10:00:00+02:00',
    end_time: '2026-11-10T10:30:00+02:00',
    duration_minutes: 30,
    note: 'Chat during tea break',
  },
  {
    start_time: '2026-11-10T13:55:00+02:00',
    end_time: '2026-11-10T14:15:00+02:00',
    duration_minutes: 20,
    note: null,
  },
  {
    start_time: '2026-11-10T16:40:00+02:00',
    end_time: '2026-11-10T17:00:00+02:00',
    duration_minutes: 20,
    note: null,
  },
  {
    start_time: '2026-11-10T17:00:00+02:00',
    end_time: '2026-11-10T17:20:00+02:00',
    duration_minutes: 20,
    note: null,
  },
  {
    start_time: '2026-11-11T08:15:00+02:00',
    end_time: '2026-11-11T08:45:00+02:00',
    duration_minutes: 30,
    note: null,
  },
  {
    start_time: '2026-11-11T10:30:00+02:00',
    end_time: '2026-11-11T11:00:00+02:00',
    duration_minutes: 30,
    note: 'Chat during tea break',
  },
];

async function seed() {
  console.log('Seeding slots into Supabase...');

  // 1. Fetch existing slots to avoid duplicates
  const { data: existing, error: fetchErr } = await supabase
    .from('slots')
    .select('start_time, end_time');

  if (fetchErr) {
    console.error('Error querying slots table. Make sure the SQL migration has been run in Supabase SQL editor:');
    console.error(fetchErr.message);
    return;
  }

  const existingKeys = new Set(
    (existing || []).map(s => `${new Date(s.start_time).toISOString()}_${new Date(s.end_time).toISOString()}`)
  );

  const slotsToInsert = SEED_SLOTS.filter(s => {
    const key = `${new Date(s.start_time).toISOString()}_${new Date(s.end_time).toISOString()}`;
    return !existingKeys.has(key);
  });

  if (slotsToInsert.length === 0) {
    console.log(`All ${SEED_SLOTS.length} slots already exist in database.`);
    return;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('slots')
    .insert(slotsToInsert)
    .select();

  if (insertErr) {
    console.error('Failed to insert slots:', insertErr.message);
  } else {
    console.log(`Successfully seeded ${inserted.length} slots!`);
  }
}

seed();
