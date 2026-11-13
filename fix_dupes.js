const fs = require('fs');
const file = 'src/lib/directory/partners.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

for (let p of data) {
    if (p.description) {
        // Find if the description is perfectly duplicated
        // e.g. "Text. Text."
        const half = Math.floor(p.description.length / 2);
        if (p.description.length > 20) {
            const firstHalf = p.description.substring(0, half).trim();
            const secondHalf = p.description.substring(half).trim();
            if (firstHalf === secondHalf) {
                p.description = firstHalf;
            }
        }
    }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Also generate the SQL file again
let sql = ``;
for (const p of data) {
  if (p.description || p.website) {
    const desc = p.description.replace(/'/g, "''");
    const web = p.website.replace(/'/g, "''");
    sql += `UPDATE partners SET description = '${desc}', website = '${web}' WHERE name = '${p.name.replace(/'/g, "''")}';\n`;
  }
}
fs.writeFileSync('update_partners.sql', sql);
