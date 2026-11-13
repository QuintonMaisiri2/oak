const { createClient } = require('@supabase/supabase-js');
const url = 'https://liychixuyqseohgijezh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeWNoaXh1eXFzZW9oZ2lqZXpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTI5NjI0MywiZXhwIjoyMTA0ODcyMjQzfQ.Vk6r5f85gUqpaSzd3TaUzGgsTQbUJ_nNvAIDU35t2yE';
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('attendees').select('*');
  if (error) console.error(error);
  console.log("Attendees count:", data ? data.length : 0);
  console.log(data);
}
main();
