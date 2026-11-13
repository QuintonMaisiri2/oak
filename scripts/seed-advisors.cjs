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

const SILVIA_BIO = `Silvia focuses on Impact and MEL (Monitoring, Evaluation and Learning). You can take the opportunity to meet with her and discuss any aspect of your MEL work and needs, regardless of where you are on your MEL journey. Whether you need feedback on an existing theory of change, results framework or MEL plan, support to develop one, or advice on meeting donor reporting requirements and demonstrating and communicating the impact of your work, she offers a space for practical, tailored guidance. You can discuss how to strengthen your impact stories with credible and feasible evidence, discuss plans for commissioning an external evaluation, seek clarification on reporting requirements, or learn about resources and support available to enhance your MEL capacity.

The clinic is intended as the start of an ongoing conversation. While it may not be possible to address every question during the session itself, Silvia will be available for follow-up discussions to ensure your MEL needs and challenges are fully supported.`;

async function seedAdvisors() {
  console.log("Seeding Silvia Guizzardi into advisors table...");

  // 1. Upsert Silvia
  const { data: advisor, error: advErr } = await supabase
    .from('advisors')
    .upsert({
      slug: 'silvia-guizzardi',
      full_name: 'Silvia Guizzardi',
      job_title: 'Senior Adviser for Impact',
      email: 'silvia.guizzardi@oakfnd.ch',
      bio: SILVIA_BIO,
      is_active: true,
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (advErr) {
    console.error("Error upserting advisor (ensure the SQL migration has been applied):", advErr.message);
    return;
  }

  console.log(`Advisor Silvia Guizzardi verified: ID ${advisor.id}`);

  // 2. Link all slots with advisor_id null to Silvia
  const { data: updatedSlots, error: slotErr } = await supabase
    .from('slots')
    .update({ advisor_id: advisor.id })
    .is('advisor_id', null)
    .select();

  if (slotErr) {
    console.warn("Could not update slots advisor_id:", slotErr.message);
  } else {
    console.log(`Linked ${updatedSlots?.length || 0} unassigned slots to Silvia.`);
  }

  console.log("Advisor seed complete.");
}

seedAdvisors();
