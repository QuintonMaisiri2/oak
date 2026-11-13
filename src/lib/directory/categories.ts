import type { Partner } from "./data";

const explicitCategories: Record<string, string> = {
  "APT": "Helping families & Communities Thrive",
  "Africa Ahead": "Helping families & Communities Thrive",
  "Bethany": "Helping families & Communities Thrive",
  "DAPP": "Helping families & Communities Thrive",
  "CAFOD": "Helping families & Communities Thrive",
  "Alfred Walter Hostel": "Support children and adults with special needs",
  "Caritas Chinhoyi": "Helping families & Communities Thrive",
  "Caritas Masvingo": "Helping families & Communities Thrive",
  "Caritas Mutare": "Helping families & Communities Thrive",
  "St Alberts Mission": "Helping families & Communities Thrive",
  "CARE": "Helping families & Communities Thrive",
  "ZimWorks": "Skills building & entrepreneurship",
  "Childline": "Helping families & Communities Thrive",
  "Council for the Blind": "Support children and adults with special needs",
  "Education Matters": "Helping families & Communities Thrive",
  "Ele Collection": "Helping families & Communities Thrive",
  "FOST": "Skills building & entrepreneurship",
  "FACE": "Helping families & Communities Thrive",
  "Family Support": "Helping families & Communities Thrive",
  "ARC": "Helping families & Communities Thrive",
  "Friendship Bench": "Helping families & Communities Thrive",
  "Foundations for Farming": "Helping families & Communities Thrive",
  "Halo Trust": "Helping families & Communities Thrive",
  "Hope for Kids": "Helping families & Communities Thrive",
  "Hospaz": "Helping families & Communities Thrive",
  "Dzikwa": "Helping families & Communities Thrive",
  "Kapnek": "Support children and adults with special needs",
  "Isheanesu": "Support children and adults with special needs",
  "Dance Trust": "Helping families & Communities Thrive",
  "St Christopher": "Support children and adults with special needs",
  "Harare Children's Rehabilitation Unit": "Helping families & Communities Thrive",
  "Kidzcan": "Helping families & Communities Thrive",
  "Island Hospice": "Helping families & Communities Thrive",
  "Nzeve": "Support children and adults with special needs",
  "Mavambo": "Helping families & Communities Thrive",
  "MASO": "Helping families & Communities Thrive",
  "Mashamba": "Helping families & Communities Thrive",
  "Ntengwe": "Helping families & Communities Thrive",
  "Londoloza": "Helping families & Communities Thrive",
  "Jafuta": "Helping families & Communities Thrive",
  "Igugu Trust": "Helping families & Communities Thrive",
  "Lesedi": "Helping families & Communities Thrive",
  "Tikobane": "Helping families & Communities Thrive",
  "RCV": "Skills building & entrepreneurship",
  "Rotary Club": "Helping families & Communities Thrive",
  "SAT": "Helping families & Communities Thrive",
  "St John": "Helping families & Communities Thrive",
  "Simukai": "Helping families & Communities Thrive",
  "Terres Des Homme": "Helping families & Communities Thrive",
  "Child Protection Society": "Helping families & Communities Thrive",
  "Community Technology Development Organisation": "Helping families & Communities Thrive",
  "Community Organisation for Poverty Alleviation": "Helping families & Communities Thrive",
  "Uncommon": "Skills building & entrepreneurship",
  "Youth Advocates": "Helping families & Communities Thrive",
  "Swiss Zim Aid": "Helping families & Communities Thrive",
  "ACT": "Helping families & Communities Thrive",
  "Rafiq Girls": "Skills building & entrepreneurship",
  "Restless Development": "Helping families & Communities Thrive",
  "Young Africa": "Skills building & entrepreneurship",
  "Chiedza": "Helping families & Communities Thrive",
  "Don Bosco Hwange": "Skills building & entrepreneurship",
  "Deaf Zimbabwe Trust": "Support children and adults with special needs",
  "ZIMCARE": "Support children and adults with special needs",
  "Zvitambo": "Helping families & Communities Thrive",
  "OAK": "Challenge Grant",
};

export function getPartnerCategories(partner: Pick<Partner, "name" | "description">): string[] {
  const cat = explicitCategories[partner.name];
  if (cat) return [cat];
  
  // Fallback for any unknown new partners added later
  const d = (partner.description || '').toLowerCase();
  const n = (partner.name || '').toLowerCase();
  
  if (d.includes('special needs') || d.includes('disabilit') || d.includes('blind') || d.includes('deaf') || d.includes('intellectual')) {
    return ['Support children and adults with special needs'];
  }
  if (d.includes('skill') || d.includes('entrepreneur') || d.includes('vocational') || d.includes('business')) {
    return ['Skills building & entrepreneurship'];
  }
  if (d.includes('grant') || n.includes('oak')) {
    return ['Challenge Grant'];
  }
  
  return ['Helping families & Communities Thrive'];
}


