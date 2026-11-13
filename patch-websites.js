const fs = require('fs');
const partners = require('./src/lib/directory/partners.json');

const updates = {
  'bethany': 'https://www.facebook.com/p/Bethany-Project-Zvishavane-Zimbabwe-100079975791652/',
  'alfred-walter-hostel': 'https://catholicdioceseofmasvingo.org/',
  'st-alberts-mission': 'https://stalbertshospital.org/',
  'isheanesu': 'https://isheanesu.org/',
  'st-christopher': 'https://stchristophers.org.zw/',
  'mashamba': 'https://www.developmentaid.org/',
  'rcv': 'https://rcz.org.zw/',
  'swiss-zim-aid': 'https://swisszimaid.ch/',
  'act': 'https://www.actionaid.org/'
};

for (const p of partners) {
  if (updates[p.id]) {
    p.website = updates[p.id];
  }
}

fs.writeFileSync('./src/lib/directory/partners.json', JSON.stringify(partners, null, 2));
