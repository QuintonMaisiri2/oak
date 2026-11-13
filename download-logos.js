const fs = require('fs');
const https = require('https');
const path = require('path');
const partners = require('./src/lib/directory/partners.json');

const logosDir = path.join(__dirname, 'public', 'logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

async function fetchLogo(partner) {
  if (!partner.website) return;
  const hostname = new URL(partner.website).hostname;
  
  // Use duckduckgo high res favicon
  const url = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(path.join(logosDir, `${partner.id}.ico`));
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else {
        resolve(false);
      }
    }).on('error', () => resolve(false));
  });
}

async function run() {
  let count = 0;
  for (const p of partners) {
    if (p.website) {
      const ok = await fetchLogo(p);
      if (ok) {
        p.logo = `/logos/${p.id}.ico`;
        count++;
      }
    }
  }
  
  fs.writeFileSync('./src/lib/directory/partners.json', JSON.stringify(partners, null, 2));
  console.log(`Downloaded ${count} logos.`);
}

run();
