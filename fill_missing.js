const fs = require('fs');
const path = 'src/lib/directory/partners.json';
let data = JSON.parse(fs.readFileSync(path, 'utf8'));

const knowledge = {
  "apt": { desc: "Appropriate Technology Africa (APT) works to improve the livelihoods of rural communities through the promotion and adoption of appropriate technologies and sustainable agricultural practices.", url: "http://www.aptafrica.com" },
  "bethany": { desc: "The Bethany Project is a registered NGO in Zimbabwe focused on community-based care and support for vulnerable children, youth, and women, emphasizing SRHR and gender-based violence prevention.", url: "" },
  "caritas-mutare": { desc: "Caritas Mutare is the social development arm of the Catholic Diocese of Mutare, focusing on emergency relief, sustainable livelihoods, and community health in Manicaland.", url: "https://caritasmutare.org/" },
  "st-alberts-mission": { desc: "St. Albert's Mission Hospital provides essential medical care and community health services to rural populations in the Centenary district of Zimbabwe.", url: "" },
  "face": { desc: "FACE Zimbabwe (Family AIDS Caring Trust) is one of the pioneer NGOs in Zimbabwe providing comprehensive HIV/AIDS care, support, and prevention services.", url: "https://www.fact.org.zw/" },
  "hope-for-kids": { desc: "Hope for Kids Zimbabwe focuses on empowering vulnerable children and orphans through education, psychosocial support, and community-based interventions.", url: "https://hopeforkidszimbabwe.com/" },
  "hospaz": { desc: "Hospice and Palliative Care Association of Zimbabwe (HOSPAZ) is the national coordinating body for palliative care organizations, advocating for quality care for patients with life-limiting illnesses.", url: "https://hospaz.co.zw/" },
  "isheanesu": { desc: "Isheanesu Multi-Purpose Centre for the Disabled provides rehabilitation, skills training, and care for children and young adults with disabilities in Harare.", url: "" },
  "dance-trust": { desc: "Dance Trust of Zimbabwe (DTZ) promotes contemporary and traditional dance as a tool for social cohesion, youth empowerment, and cultural preservation.", url: "https://www.dancetrust.co.zw/" },
  "st-christopher": { desc: "St Christopher's provides specialized care and educational support for children with severe disabilities and developmental challenges.", url: "" },
  "mashamba": { desc: "Mashamba Trust supports rural development and food security through sustainable agriculture and women's empowerment initiatives.", url: "" },
  "rcv": { desc: "Rehabilitation Centre for the Visually Impaired (RCV) provides vocational training and rehabilitation services to empower visually impaired individuals.", url: "" },
  "sat": { desc: "Sustainable Agriculture Technology (SAT) Zimbabwe promotes sustainable and climate-smart agricultural practices to improve the livelihoods of smallholder farmers.", url: "https://www.satzim.org.zw/" },
  "st-john": { desc: "St John Ambulance Zimbabwe provides first aid training, emergency medical services, and community health programs across the country.", url: "https://stjohn.org.zw/" },
  "swiss-zim-aid": { desc: "Swiss Zim Aid focuses on improving rural education and healthcare infrastructure through community-driven development projects.", url: "" },
  "act": { desc: "Action Churches Together (ACT) coordinates faith-based humanitarian and development initiatives to support vulnerable populations in Zimbabwe.", url: "" },
  "zvitambo": { desc: "Zvitambo Institute for Maternal and Child Health Research conducts high-impact public health research to improve the survival and well-being of mothers and children in Zimbabwe.", url: "https://www.zvitambo.com/" },
  "caritas-chinhoyi": { desc: "Caritas Chinhoyi is the development arm of the Catholic Diocese of Chinhoyi, focusing on food security, water and sanitation (WASH), and emergency relief.", url: "https://caritaschinhoyizim.org/" },
  "caritas-masvingo": { desc: "Caritas Masvingo provides humanitarian assistance, promotes sustainable agriculture, and supports community development in the Masvingo province.", url: "https://caritasmasvingozim.co.zw/" },
  "care": { desc: "CARE International in Zimbabwe works to save lives, defeat poverty, and achieve social justice, with a strong focus on women and girls, food security, and climate resilience.", url: "https://www.carezimbabwe.org/" },
  "zimworks": { desc: "ZimWorX provides business process outsourcing (BPO) and remote staffing solutions, creating sustainable employment opportunities and career development for Zimbabwean youth.", url: "https://zimworx.com/" },
  "childline": { desc: "Childline Zimbabwe operates a free, 24-hour helpline and provides drop-in centers to offer counseling, support, and child protection services for abused and vulnerable children.", url: "https://childline.org.zw/" },
  "council-for-the-blind": { desc: "Council for the Blind Zimbabwe prevents blindness and restores sight by providing specialized eye care, surgical outreach, and inclusive education for visually impaired children.", url: "https://councilfortheblind.org.zw/" },
  "education-matters": { desc: "Education Matters helps high-achieving, low-income African students access international educational opportunities through programs like the USAP Community School.", url: "https://www.edmattersafrica.org/" },
  "ele-collection": { desc: "Ele Collection is a social enterprise that supports wildlife conservation and local artisans through the ethical production and sale of handcrafted goods.", url: "https://elecollection.co/" },
  "fost": { desc: "Farm Orphan Support Trust (FOST) works to protect and support orphans and vulnerable children in farming communities through community-based care, education, and livelihood skills.", url: "https://fost.co.zw/" },
  "family-support": { desc: "Family Support Trust (FST) provides medical and psychosocial services to survivors of sexual and gender-based violence, focusing on child survivors and their families.", url: "https://fst.co.zw/" },
  "friendship-bench": { desc: "The Friendship Bench is an evidence-based mental health intervention that trains community health workers (grandmothers) to provide problem-solving therapy on wooden benches.", url: "https://www.friendshipbenchzimbabwe.org/" },
  "foundations-for-farming": { desc: "Foundations for Farming is a Christian NGO teaching sustainable, conservation agriculture methods to farmers to ensure food security and financial stability.", url: "https://foundationsforfarming.org/" },
  "halo-trust": { desc: "The HALO Trust in Zimbabwe clears landmines and unexploded ordnance, making land safe for agriculture, development, and wildlife conservation.", url: "https://www.halotrust.org/where-we-work/africa/zimbabwe/" },
  "dzikwa": { desc: "Dzikwa Trust supports orphans and vulnerable children in the Dzivarasekwa community by providing education, meals, and psychosocial support.", url: "https://www.dzikwatrust.org/" },
  "kapnek": { desc: "JF Kapnek Trust focuses on pediatric HIV prevention, inclusive early childhood development, and rehabilitation services for children with disabilities.", url: "https://www.jfkapnek.org/" },
  "harare-children-s-rehabilitation-unit": { desc: "The Harare Children's Hospital Rehabilitation Unit provides specialized physical and occupational therapy for children recovering from illness, injury, or congenital conditions.", url: "https://www.hararechildrenhospitaltrust.org/project/cru/" },
  "kidzcan": { desc: "KidzCan Zimbabwe is dedicated to increasing the survival rate of children with cancer through provision of chemotherapy, medical supplies, and psychosocial support.", url: "https://kidzcanzimbabwe.org/" },
  "island-hospice": { desc: "Island Hospice and Healthcare is the first hospice in Africa, providing holistic palliative care, bereavement counseling, and capacity building for healthcare professionals.", url: "https://islandhospice.co.zw/" },
  "nzeve": { desc: "Nzeve Deaf Centre provides early intervention, education, and vocational training to empower deaf children, youth, and their families in Manicaland.", url: "https://nzeve.org.zw/" },
  "mavambo": { desc: "Mavambo Orphan Care empowers orphans and vulnerable children in Harare East through educational support, health services, and child protection interventions.", url: "https://mavambotrust.org.zw/" },
  "maso": { desc: "Midlands AIDS Service Organisation (MASO) offers comprehensive HIV/AIDS prevention, care, and support services to communities in the Midlands Province.", url: "https://maso.org.zw/" },
  "ntengwe": { desc: "Ntengwe for Community Development promotes social and economic justice for marginalized communities in Binga and Hwange through climate resilience, child rights, and women's empowerment.", url: "https://ntengwe-dev.net/" },
  "londoloza": { desc: "Londoloza Trust focuses on environmental conservation, sustainable community development, and wildlife protection in Zimbabwe.", url: "https://www.londolozatrust.com/" },
  "jafuta": { desc: "The Jafuta Foundation works in the Victoria Falls region to support education, wildlife conservation, healthcare, and cultural preservation.", url: "https://www.jafutafoundation.org/" },
  "rotary-club": { desc: "The Rotary Club of Harare implements community service projects focused on health, education, water and sanitation, and economic development.", url: "https://rotaryclubofharare.org/" },
  "terres-des-homme": { desc: "Terre des Hommes works in Zimbabwe to protect children from exploitation, improve maternal and child health, and support vulnerable youth.", url: "https://terredeshommes.it/eng/projects/zimbabwe/" },
  "child-protection-society": { desc: "Child Protection Society (CPS) advocates for children's rights and provides direct support services, including early childhood development and foster care programs.", url: "https://cps.org.zw/" },
  "community-technology-development-organisation": { desc: "CTDO focuses on biodiversity conservation, food security, and climate change adaptation by empowering smallholder farmers and promoting indigenous seed systems.", url: "http://ctdt.co.zw/" },
  "community-organisation-for-poverty-alleviation": { desc: "COPAZ works to eradicate poverty and promote sustainable development through community-led agricultural and economic empowerment initiatives.", url: "https://www.copaz.co.zw/" },
  "uncommon": { desc: "Uncommon.org builds technology hubs in low-income communities, providing coding education and creating local tech employment opportunities for young adults.", url: "https://www.uncommon.org/" },
  "youth-advocates": { desc: "Youth Advocates Zimbabwe utilizes innovation and peer-led approaches to promote sexual and reproductive health, HIV prevention, and youth empowerment.", url: "https://yadvocates.org/" },
  "rafiq-girls": { desc: "Rafiki Girls Centre provides vocational training, life skills, and psychosocial support to empower disadvantaged young women.", url: "https://rafikigirlscentre.org/" },
  "restless-development": { desc: "Restless Development is a youth-led agency that empowers young people to lead change in their communities, focusing on civic participation, livelihoods, and sexual reproductive health.", url: "https://restlessdevelopment.org/" },
  "young-africa": { desc: "Young Africa provides technical and vocational education and training (TVET) integrated with life skills and entrepreneurship training to empower marginalized youth.", url: "https://youngafrica.org/zimbabwe/" },
  "chiedza": { desc: "Chiedza Child Care Centre provides holistic support to orphans and vulnerable children in Ardbennie, Harare, focusing on education, health, and child protection.", url: "https://www.chiedza.org/" },
  "don-bosco-hwange": { desc: "Don Bosco Hwange offers technical and vocational training, youth development programs, and community support in the Hwange district.", url: "https://donboscohwg.co.zw/" },
  "deaf-zimbabwe-trust": { desc: "Deaf Zimbabwe Trust advocates for the rights of the deaf and hard of hearing, promoting sign language, inclusive education, and equal opportunities.", url: "http://deafzimbabwetrust.org/" },
  "zimcare": { desc: "ZIMCARE Trust operates specialized schools and centers across Zimbabwe, providing education, care, and rehabilitation for children with intellectual disabilities.", url: "https://zimcaretrust.org/" }
};

let sql = '';

for (let p of data) {
  if (knowledge[p.id]) {
    if (!p.description) p.description = knowledge[p.id].desc;
    if (!p.website) p.website = knowledge[p.id].url;
  }
  
  if (p.description || p.website) {
    const desc = p.description.replace(/'/g, "''");
    const web = p.website.replace(/'/g, "''");
    sql += `UPDATE partners SET description = '${desc}', website = '${web}' WHERE name = '${p.name.replace(/'/g, "''")}';\n`;
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
fs.writeFileSync('update_partners_full.sql', sql);
