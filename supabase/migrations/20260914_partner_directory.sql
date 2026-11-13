-- Run once in Supabase SQL Editor before deploying; safe to rerun.
-- Existing unrelated partner rows are preserved.
BEGIN;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS directory_slug TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS partners_directory_slug_key ON public.partners(directory_slug);

CREATE TEMP TABLE oak_partner_import (slug TEXT, name TEXT, description TEXT, website TEXT) ON COMMIT DROP;
INSERT INTO oak_partner_import VALUES
('apt', 'APT', '', ''),
('africa-ahead', 'Africa Ahead', 'To enable government ministries, agencies, communities, and NGOs to roll out sustainable, integrated development programmes at scale through institutionalizing the Community Health Club model in national programmes to alleviate poverty, discrimination, ignorance and disease.', 'https://africaahead.org/'),
('bethany', 'Bethany', '', ''),
('dapp', 'DAPP', 'We complement Zimbabwe''s government efforts with quality community-led projects in five thematic areas of development.', 'https://www.dapp-zimbabwe.org/'),
('cafod', 'CAFOD', 'CAFOD (the Catholic Agency for Overseas Development) is the official aid agency of the Catholic Church in England and Wales, working to fight poverty, injustice, and the climate crisis in more than 40 countries.', 'https://cafod.org.uk/about-us/where-we-work/africa/zimbabwe'),
('alfred-walter-hostel', 'Alfred Walter Hostel', 'Alfred Walter Hostel is a residential care and boarding facility located in Masvingo, Zimbabwe, that provides a warm home, specialized care, and skills training for about 150 children and youth with intellectual and mental challenges.', ''),
('caritas-chinhoyi', 'Caritas Chinhoyi', '', 'https://caritaschinhoyizim.org/'),
('caritas-masvingo', 'Caritas Masvingo', '', 'https://caritasmasvingozim.co.zw/'),
('caritas-mutare', 'Caritas Mutare', '', ''),
('st-alberts-mission', 'St Alberts Mission', '', ''),
('care', 'CARE', '', 'https://www.carezimbabwe.org/'),
('zimworks', 'ZimWorks', '', 'https://zimworx.com/'),
('childline', 'Childline', '', 'https://childline.org.zw/'),
('council-for-the-blind', 'Council for the Blind', '', 'https://councilfortheblind.org.zw/'),
('education-matters', 'Education Matters', '', 'https://www.edmattersafrica.org/'),
('ele-collection', 'Ele Collection', '', 'https://elecollection.co/'),
('fost', 'FOST', '', 'https://fost.co.zw/'),
('face', 'FACE', '', ''),
('family-support', 'Family Support', '', 'https://fst.co.zw/'),
('arc', 'ARC', 'The Adult Rape Clinic (ARC) was established as a response to the dire lack of appropriate facilities for a comprehensive and sensitive response for rape survivors in government hospitals in Harare and aims to establish a model for replication throughout the country. It provides comprehensive management including medical management, counseling and support services and has formed partnerships with organizations providing complementary services such as ongoing psycho-social support, police and legal services, as well as prevention, awareness raising and advocacy surrounding gender based violence issues.', 'https://adultrapeclinic.org/'),
('friendship-bench', 'Friendship Bench', '', 'https://www.friendshipbenchzimbabwe.org/'),
('foundations-for-farming', 'Foundations for Farming', '', 'https://foundationsforfarming.org/'),
('halo-trust', 'Halo Trust', '', 'https://www.halotrust.org/where-we-work/africa/zimbabwe/'),
('hope-for-kids', 'Hope for Kids', '', ''),
('hospaz', 'Hospaz', '', ''),
('dzikwa', 'Dzikwa', '', 'https://www.dzikwatrust.org/'),
('kapnek', 'Kapnek', '', 'https://www.jfkapnek.org/'),
('isheanesu', 'Isheanesu', '', ''),
('dance-trust', 'Dance Trust', '', ''),
('st-christopher', 'St Christopher', '', ''),
('harare-children-s-rehabilitation-unit', 'Harare Children''s Rehabilitation Unit', '', 'https://www.hararechildrenhospitaltrust.org/project/cru/'),
('kidzcan', 'Kidzcan', '', 'https://kidzcanzimbabwe.org/'),
('island-hospice', 'Island Hospice', '', 'https://islandhospice.co.zw/'),
('nzeve', 'Nzeve', '', 'https://nzeve.org.zw/'),
('mavambo', 'Mavambo', '', 'https://mavambotrust.org.zw/'),
('maso', 'MASO', '', 'https://maso.org.zw/'),
('mashamba', 'Mashamba', '', ''),
('ntengwe', 'Ntengwe', '', 'https://ntengwe-dev.net/'),
('londoloza', 'Londoloza', '', 'https://www.londolozatrust.com/'),
('jafuta', 'Jafuta', '', 'https://www.jafutafoundation.org/'),
('igugu-trust', 'Igugu Trust', 'IGugu trust was formed in Zimbabwe in the year 2017 to encourage care and well-being for communities and all living systems, and for the soil by providing trainings to Hwange Communal Lands and other organizations on regeneration.', 'https://www.igugutrust.net/'),
('lesedi', 'Lesedi', 'The Lesedi project began in 2014, when the founders built a small shack to offer pre-school classes to local children living in a rural area near Victoria Falls, Zimbabwe. Subsequent years have seen the addition of a primary school, secondary school and clinic. Most learners are sponsored, and nutritious school meals are provided. Lesedi receives no government support and the project is supported by private donations through UK registered charity, Ngoko Charitable Trust.', 'https://lesedizim.org/'),
('tikobane', 'Tikobane', 'Tikobane Trust works with communities in and around Dete, Zimbabwe, to improve livelihoods, promote animal welfare, empower young people and create sustainable solutions for human-wildlife coexistence.', 'https://www.tikobanezimbabwe.org/'),
('rcv', 'RCV', '', ''),
('rotary-club', 'Rotary Club', '', 'https://rotaryclubofharare.org/'),
('sat', 'SAT', '', ''),
('st-john', 'St John', '', ''),
('simukai', 'Simukai', 'A child friendly socio-economic environment in which children and youths enjoy their rights and contribute to their communities.', 'https://www.simukaicpp.org.zw/'),
('terres-des-homme', 'Terres Des Homme', '', 'https://terredeshommes.it/eng/projects/zimbabwe/'),
('child-protection-society', 'Child Protection Society', '', 'https://cps.org.zw/'),
('community-technology-development-organisation', 'Community Technology Development Organisation', '', 'http://ctdt.co.zw/'),
('community-organisation-for-poverty-alleviation', 'Community Organisation for Poverty Alleviation', '', 'https://www.copaz.co.zw/'),
('uncommon', 'Uncommon', '', 'https://www.uncommon.org/'),
('youth-advocates', 'Youth Advocates', '', 'https://yadvocates.org/'),
('swiss-zim-aid', 'Swiss Zim Aid', '', ''),
('act', 'ACT', '', ''),
('rafiq-girls', 'Rafiq Girls', '', 'https://rafikigirlscentre.org/'),
('restless-development', 'Restless Development', '', 'https://restlessdevelopment.org/'),
('young-africa', 'Young Africa', '', 'https://youngafrica.org/zimbabwe/'),
('chiedza', 'Chiedza', '', 'https://www.chiedza.org/'),
('don-bosco-hwange', 'Don Bosco Hwange', '', 'https://donboscohwg.co.zw/'),
('deaf-zimbabwe-trust', 'Deaf Zimbabwe Trust', '', 'http://deafzimbabwetrust.org/'),
('zimcare', 'ZIMCARE', '', 'https://zimcaretrust.org/'),
('zvitambo', 'Zvitambo', '', ''),
('oak', 'OAK', '', '');

-- Reuse one existing matching row instead of duplicating it.
UPDATE public.partners p SET directory_slug = incoming.slug
FROM oak_partner_import incoming
WHERE p.id = (SELECT existing.id FROM public.partners existing
              WHERE lower(trim(existing.name)) = lower(incoming.name)
                AND existing.directory_slug IS NULL
              ORDER BY existing.created_at, existing.id LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM public.partners claimed WHERE claimed.directory_slug = incoming.slug);

INSERT INTO public.partners(directory_slug, name, description, website, logo, region)
SELECT slug, name, description, website, '', '' FROM oak_partner_import
ON CONFLICT (directory_slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, website = EXCLUDED.website;
COMMIT;
