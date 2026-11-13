const fs = require('fs');
const https = require('https');
const partners = require('./src/lib/directory/partners.json');

async function checkLogos() {
  let found = 0;
  let missing = 0;
  
  for (const p of partners) {
    if (!p.website) {
      missing++;
      continue;
    }
    
    let hostname = '';
    try {
      hostname = new URL(p.website).hostname;
    } catch {
      missing++;
      continue;
    }

    await new Promise(resolve => {
      https.get(`https://logo.clearbit.com/${hostname}`, (res) => {
        if (res.statusCode === 200) {
          found++;
        } else {
          missing++;
        }
        resolve();
      }).on('error', () => {
        missing++;
        resolve();
      });
    });
  }
  
  console.log(`Found: ${found}, Missing: ${missing}`);
}

checkLogos();
