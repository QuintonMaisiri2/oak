const fs = require('fs');
const partners = JSON.parse(fs.readFileSync('src/lib/directory/partners.json'));
let out = 'const explicitCategories: Record<string, string> = {\n';
partners.forEach(p => {
  const d = p.description.toLowerCase();
  let cat = 'Helping families & Communities Thrive';
  if (d.includes('special needs') || d.includes('disabilit') || d.includes('blind') || d.includes('deaf') || d.includes('intellectual') || p.name.includes('Jairos')) {
    cat = 'Support children and adults with special needs';
  } else if (d.includes('skill') || d.includes('entrepreneur') || d.includes('business') || d.includes('vocational') || d.includes('codin') || p.name.includes('Uncommon')) {
    cat = 'Skills building & entrepreneurship';
  } else if (d.includes('grant') || p.name.includes('OAK') || p.name.includes('Challenge')) {
    cat = 'Challenge Grant';
  }
  out += '  "' + p.name.replace(/"/g, '\\"') + '": "' + cat + '",\n';
});
out += '};\n';
fs.writeFileSync('temp_mapping.txt', out);
