const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const partners = require('./src/lib/directory/partners.json');

const logosDir = path.join(__dirname, 'public', 'logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = new URL(loc, url).href;
        return fetchUrl(loc).then(resolve);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

function downloadImage(url, dest) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) loc = new URL(loc, url).href;
        return downloadImage(loc, dest).then(resolve);
      }
      if (res.statusCode !== 200) return resolve(false);
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function run() {
  let count = 0;
  for (let i = 0; i < partners.length; i++) {
    const p = partners[i];
    if (p.logo) continue; // skip if already has logo
    
    let imgUrl = null;
    
    if (p.website) {
      console.log(`Fetching ${p.website}...`);
      const html = await fetchUrl(p.website);
      
      // Try to find og:image
      let match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
      if (match) {
        imgUrl = match[1];
      } else {
        // Try to find logo in img src
        match = html.match(/<img[^>]+src="([^"]+logo[^"]+)"/i) || html.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*logo[^"]*"/i);
        if (match) {
          imgUrl = match[1];
        }
      }
      
      if (imgUrl) {
        if (!imgUrl.startsWith('http')) {
          imgUrl = new URL(imgUrl, p.website).href;
        }
        console.log(`Found image URL for ${p.name}: ${imgUrl}`);
        
        // Determine extension
        let ext = '.png';
        if (imgUrl.toLowerCase().includes('.jpg') || imgUrl.toLowerCase().includes('.jpeg')) ext = '.jpg';
        if (imgUrl.toLowerCase().includes('.svg')) ext = '.svg';
        
        const dest = path.join(logosDir, `${p.id}${ext}`);
        const ok = await downloadImage(imgUrl, dest);
        if (ok) {
          p.logo = `/logos/${p.id}${ext}`;
          count++;
        }
      }
    }
  }
  
  fs.writeFileSync('./src/lib/directory/partners.json', JSON.stringify(partners, null, 2));
  console.log(`Downloaded ${count} logos.`);
}

run();
