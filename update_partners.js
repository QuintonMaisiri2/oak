const fs = require('fs');

const rawText = `APT
Africa Ahead
To enable government ministries, agencies, communities, and NGOs to roll out sustainable, integrated development programmes at scale through institutionalizing the Community Health Club model in national programmes to alleviate poverty, discrimination, ignorance and disease.
[https://africaahead.org/](https://africaahead.org/)
Bethany
DAPP
We complement Zimbabwe's government efforts with quality community-led projects in five thematic areas of development.
[https://www.dapp-zimbabwe.org/](https://www.dapp-zimbabwe.org/)
CAFOD
[CAFOD (the Catholic Agency for Overseas Development) is the official aid agency of the Catholic Church in England and Wales, working to fight poverty, injustice, and the climate crisis in more than 40 countries](https://cafod.org.uk/)
[https://cafod.org.uk/about-us/where-we-work/africa/zimbabwe](https://cafod.org.uk/about-us/where-we-work/africa/zimbabwe)
Alfred Walter Hostel
Alfred Walter Hostel is a residential care and boarding facility located in Masvingo, Zimbabwe, that provides a warm home, specialized care, and skills training for about 150 children and youth with intellectual and mental challenges.
Caritas Chinhoyi
[https://caritaschinhoyizim.org/](https://caritaschinhoyizim.org/)
Caritas Masvingo
[https://caritasmasvingozim.co.zw/](https://caritasmasvingozim.co.zw/)
Caritas Mutare
St Alberts Mission
CARE
[https://www.carezimbabwe.org/](https://www.carezimbabwe.org/)
ZimWorks
[https://zimworx.com/](https://zimworx.com/)
Childline
[https://childline.org.zw/](https://childline.org.zw/)
Council for the Blind
[https://councilfortheblind.org.zw/](https://councilfortheblind.org.zw/)
Education Matters
[https://www.edmattersafrica.org/](https://www.edmattersafrica.org/)
Ele Collection
[https://elecollection.co/](https://elecollection.co/)
FOST
[https://fost.co.zw/](https://fost.co.zw/)
FACE
Family Support
[https://fst.co.zw/](https://fst.co.zw/)
ARC
The Adult Rape Clinic (ARC) was established as a response to the dire lack of appropriate facilities for a comprehensive and sensitive response for rape survivors in government hospitals in Harare and aims to establish a model for replication throughout the country. It provides comprehensive management including medical management, counseling and support services and has formed partnerships with organizations providing complementary services such as ongoing psycho-social support, police and legal services, as well as prevention, awareness raising and advocacy surrounding gender based violence issues.
[https://adultrapeclinic.org/](https://adultrapeclinic.org/)
Friendship Bench
[https://www.friendshipbenchzimbabwe.org/](https://www.friendshipbenchzimbabwe.org/)
Foundations for Farming
[https://foundationsforfarming.org/](https://foundationsforfarming.org/)
Halo Trust
[https://www.halotrust.org/where-we-work/africa/zimbabwe/](https://www.halotrust.org/where-we-work/africa/zimbabwe/)
Hope for Kids
Hospaz
[https://hopeforkidszimbabwe.com/](https://hopeforkidszimbabwe.com/)
Dzikwa
[https://www.dzikwatrust.org/](https://www.dzikwatrust.org/)
Kapnek
[https://www.jfkapnek.org/](https://www.jfkapnek.org/)
Isheanesu
Dance Trust
St Christopher
Harare Children's Rehabilitation Unit
[https://www.hararechildrenhospitaltrust.org/project/cru/](https://www.hararechildrenhospitaltrust.org/project/cru/)
Kidzcan
[https://kidzcanzimbabwe.org/](https://kidzcanzimbabwe.org/)
Island Hospice
[https://islandhospice.co.zw/](https://islandhospice.co.zw/)
Nzeve
[https://nzeve.org.zw/](https://nzeve.org.zw/)
Mavambo
[https://mavambotrust.org.zw/](https://mavambotrust.org.zw/)
MASO
[https://maso.org.zw/](https://maso.org.zw/)
Mashamba
Ntengwe
[https://ntengwe-dev.net/](https://ntengwe-dev.net/)
Londoloza
[https://www.londolozatrust.com/](https://www.londolozatrust.com/)
Jafuta
[https://www.jafutafoundation.org/](https://www.jafutafoundation.org/)
Igugu Trust
IGugu trust was formed in Zimbabwe in the year 2017 to encourage care and well-being for communities and all living systems, and for the soil by providing trainings to Hwange Communal Lands and other organizations on regeneration.
[https://www.igugutrust.net/](https://www.igugutrust.net/)
Lesedi
The Lesedi project began in 2014, when the founders built a small shack to offer pre-school classes to local children living in a rural area near Victoria Falls, Zimbabwe. Subsequent years have seen the addition of a primary school, secondary school and clinic. Most learners are sponsored, and nutritious school meals are provided. Lesedi receives no government support and the project is supported by private donations through UK registered charity, Ngoko Charitable Trust.
[https://lesedizim.org/](https://lesedizim.org/)
Tikobane
Tikobane Trust works with communities in and around Dete, Zimbabwe, to improve livelihoods, promote animal welfare, empower young people and create sustainable solutions for human-wildlife coexistence.
[https://www.tikobanezimbabwe.org/](https://www.tikobanezimbabwe.org/)
RCV
Rotary Club
[https://rotaryclubofharare.org/](https://rotaryclubofharare.org/)
SAT
St John
Simukai
A child friendly socio-economic environment in which children and youths enjoy their rights and contribute to their communities.
[https://www.simukaicpp.org.zw/](https://www.simukaicpp.org.zw/)
Terres Des Homme
[https://terredeshommes.it/eng/projects/zimbabwe/](https://terredeshommes.it/eng/projects/zimbabwe/)
Child Protection Society
[https://cps.org.zw/](https://cps.org.zw/)
Community Technology Development Organisation
[http://ctdt.co.zw/](http://ctdt.co.zw/)
Community Organisation for Poverty Alleviation
[https://www.copaz.co.zw/](https://www.copaz.co.zw/)
Uncommon
[https://www.uncommon.org/](https://www.uncommon.org/)
Youth Advocates
[https://yadvocates.org/](https://yadvocates.org/)
Swiss Zim Aid
ACT
Rafiq Girls
[https://rafikigirlscentre.org/](https://rafikigirlscentre.org/)
Restless Development
[https://restlessdevelopment.org/](https://restlessdevelopment.org/)
Young Africa
[https://youngafrica.org/zimbabwe/](https://youngafrica.org/zimbabwe/)
Chiedza
[https://www.chiedza.org/](https://www.chiedza.org/)
Don Bosco Hwange
[https://donboscohwg.co.zw/](https://donboscohwg.co.zw/)
Deaf Zimbabwe Trust
[http://deafzimbabwetrust.org/](http://deafzimbabwetrust.org/)
ZIMCARE
[https://zimcaretrust.org/](https://zimcaretrust.org/)
Zvitambo
OAK
[https://oakfnd.org/](https://oakfnd.org/)`;

const partnersData = JSON.parse(fs.readFileSync('src/lib/directory/partners.json', 'utf8'));
const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// We need to parse this unstructured list.
// The list mostly starts with the partner Name. Then maybe description, then maybe website.
let currentPartner = null;

function findPartnerByName(name) {
  const normName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return partnersData.find(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName);
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Is this line a partner name?
  const p = findPartnerByName(line);
  if (p) {
    currentPartner = p;
    continue;
  }
  
  if (!currentPartner) continue;

  // If it's a URL (starts with http or [http)
  if (line.match(/https?:\/\//)) {
    let url = line;
    // Extract url from markdown if present [text](url)
    const mdMatch = line.match(/\]\((https?:\/\/[^\)]+)\)/);
    if (mdMatch) {
      url = mdMatch[1];
    } else {
        const textMatch = line.match(/(https?:\/\/[^\s\]]+)/);
        if (textMatch) url = textMatch[1];
    }
    
    // Check if line also has a description like [description](url)
    if (line.startsWith('[') && !line.startsWith('[http')) {
        const descMatch = line.match(/^\[(.*?)\]/);
        if (descMatch && descMatch[1] && descMatch[1].length > 20) {
            currentPartner.description = descMatch[1];
        }
    }
    
    currentPartner.website = url;
  } else {
    // It's a description
    if (!currentPartner.description) {
      currentPartner.description = line;
    } else {
      currentPartner.description += ' ' + line;
    }
  }
}

fs.writeFileSync('src/lib/directory/partners.json', JSON.stringify(partnersData, null, 2));

// Generate SQL
let sql = ``;
for (const p of partnersData) {
  if (p.description || p.website) {
    const desc = p.description.replace(/'/g, "''");
    const web = p.website.replace(/'/g, "''");
    sql += `UPDATE partners SET description = '${desc}', website = '${web}' WHERE name = '${p.name.replace(/'/g, "''")}';\n`;
  }
}
fs.writeFileSync('update_partners.sql', sql);
