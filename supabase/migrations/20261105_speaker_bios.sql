-- ==============================================================================
-- Speaker bios from "OAK Speaker Profiles.pdf" (Uncommon.org, 4 Nov 2026).
-- Updates role, organisation, bio and agenda name spellings; creates the profile if
-- it doesn't exist. Photos, featured flag, order and visibility are left untouched.
-- Safe to run more than once.
-- ==============================================================================

-- The PDF names the Friendship Bench breakout lead "Tapiwa Leslie Takaona" (agenda: "Tapiwa Chikwana")
UPDATE public.people
SET slug = 'tapiwa-leslie-takaona'
WHERE slug = 'tapiwa-chikwana'
  AND NOT EXISTS (SELECT 1 FROM public.people WHERE slug = 'tapiwa-leslie-takaona');

INSERT INTO public.people AS p (slug, full_name, role, organization, category, aliases, advisor_slug, is_featured, sort_order, bio)
VALUES
  ('michelle-gwatiringa', 'Michelle Gwatiringa', 'Country Director', 'Uncommon.org Zimbabwe', 'moderator', '{}', NULL, false, 60,
   $$Michelle is the Country Director of Uncommon.org Zimbabwe, where she leads efforts to give young people access to technology education and life-changing opportunities. Drawing on experience in business operations, programme administration, and leadership, she builds sustainable solutions that empower communities, driving lasting impact in Zimbabwe.$$),

  ('charity-bafana', 'Charity Bafana', 'Co-Director, Zimbabwe & Global People and Operations Director', 'Restless Development', 'speaker', '{}', NULL, false, 100,
   $$Charity Bafana is the Restless Development Zimbabwe Co-Director and the Global People and Operations Director. With nearly two decades across the development sector, she brings expertise in organisational development, strategy, compliance, youth programming, and leadership development. Her approach blends strategic systems thinking with on the ground implementation, enabling organisations to build resilient teams and drive meaningful impact even with constrained resources.$$),

  ('natalie-simbini', 'Natalie Simbini', 'Development & Fundraising Lead', 'Friendship Bench', 'speaker', '{}', NULL, false, 100,
   $$Natalie Simbini is the Development & Fundraising Lead at Friendship Bench. With 15 years across the development and humanitarian sectors, she brings expertise in business development, strategic planning, project management, M&E, compliance, and brand management, blending analytical thinking and relationship-building to drive the partnerships and revenue that enable meaningful impact.$$),

  ('rati-moyo', 'Ratidzai Moyo', 'Director', 'Childline Zimbabwe', 'speaker', ARRAY['Rati Moyo', 'Ratie Moyo'], NULL, false, 100,
   $$Ratidzai Moyo is the Director of Childline Zimbabwe, where they oversee operations and strategic direction. Their career has been built within Childline, rising from Social Worker through case management, organisational development, and programme leadership roles to lead the organisation, a path that reflects a deep commitment to protecting vulnerable children.$$),

  ('tatenda-songore', 'Tatenda Songore', 'Social Entrepreneur & Founder', 'Youth Advocates Zimbabwe', 'speaker', '{}', NULL, false, 100,
   $$Tatenda Songore is a multi-award-winning social entrepreneur and founder of three NGOs that reach over 100,000 young people each year with solutions in adolescent health, behaviour change, and economic empowerment. He has shaped policy, trained thousands of young leaders, and led digital innovations in health and education, and is an ambassador for the Anzisha Prize, UNESCO Youth, and O.S.E.R L’Afrique.$$),

  ('silvia-guizzardi', 'Silvia Guizzardi', 'Senior Adviser for Impact', 'Oak Foundation', 'oak', '{}', 'silvia-guizzardi', false, 40,
   $$Silvia Guizzardi is Senior Adviser for Impact at Oak Foundation, with over 20 years of global experience in monitoring and evaluation, strategy development, and capacity building. She has designed and supported the development of M&E strategies, grant management approaches, and reporting systems for international organisations, NGOs, and research institutions, and supported programmes in conservation, poverty reduction, rural development, food security, and animal welfare.$$),

  ('cheryl-chang', 'Cheryl Chang', 'Chief of Staff & Director of the Environment Programme', 'Oak Foundation', 'oak', '{}', NULL, true, 20,
   $$Cheryl Chang is Chief of Staff and Director of the Environment Programme at Oak Foundation, with expertise in capacity building, partnership development, project management, organisational effectiveness, and international development. Her work spans homelessness and poverty, environmental policy, philanthropy, emergency relief, children’s health, and international chemicals policy, driven by a commitment to strengthening the organisations and partnerships that make lasting change possible.$$),

  ('hillary-tanyanyiwa', 'Hillary Tanyanyiwa', 'Executive Director', 'JF Kapnek Zimbabwe', 'speaker', '{}', NULL, false, 100,
   $$Hillary Tanyanyiwa is the Executive Director of JF Kapnek Zimbabwe, bringing a proven track record in fundraising and a strong reputation for networking, representation, and persuasive communication with senior stakeholders. Known for steady leadership under pressure and in volatile environments, Hillary builds effective working relationships across staff, board, and partners, grounded in a high level of emotional intelligence.$$),

  ('eleonora-aralla', 'Eleonora Aralla', 'Country Representative', 'CAFOD Zimbabwe', 'speaker', '{}', NULL, false, 100,
   $$Eleonora Aralla is the Country Representative for CAFOD Zimbabwe, where she leads strategic and operational planning and oversees programme design, implementation, and supervision, both technical and financial. Her expertise spans monitoring and evaluation, research design and data analysis, community-based development and participatory planning, and partner capacity building. She manages relationships with donors, local institutions, and the private sector, and oversees human resources.$$),

  ('tapiwa-leslie-takaona', 'Tapiwa Leslie Takaona', 'Head of Strategic Information and Evaluation', 'Friendship Bench Zimbabwe', 'speaker', ARRAY['Tapiwa Chikwana', 'Tapiwa Takaona'], NULL, false, 100,
   $$Tapiwa Leslie Takaona is the Head of Strategic Information and Evaluation at Friendship Bench Zimbabwe, where he leads the data analysis and strategic evaluation that guide the organisation’s programmes and strengthen public health outcomes. With a strong foundation in monitoring and evaluation built through academic training and professional experience, he focuses on data-driven insights and policy analysis, assessing programme effectiveness and leading evaluations to drive continual improvement and maximise community impact.$$),

  ('shupikai-chisero', 'Shupikai Chisero', 'Executive Director & Chief of Party', 'HOSPAZ', 'speaker', '{}', NULL, false, 100,
   $$Shupikai Chisero is the Executive Director and Chief of Party at the Hospice and Palliative Care Association of Zimbabwe (HOSPAZ). An experienced programme leader in the non-profit sector, Shupikai brings expertise in child welfare and children’s rights, counselling psychology, crisis intervention, and psychotherapy. Shupikai holds a Master of Social Science in Child and Family Studies from Africa University, a Postgraduate Diploma in Social Work from the Women’s University in Africa, and a BSc (Hons) in Psychology from the University of Zimbabwe.$$),

  ('rebecca-gumbo', 'Rebecca Gumbo', 'Director', 'Bethany Project', 'speaker', '{}', NULL, false, 100,
   $$Rebecca Gumbo is the Director of Bethany Project, a child- and youth-centred organization in Zimbabwe. With over 16 years of leadership experience, she provides strategic direction, financial and project management expertise to programs supporting children, youth and communities. Her professional strength spans across child welfare, protection, gender justice, humanitarian response, and psychosocial support. Rebecca is highly skilled in networking and building collaborative partnerships that enhance impact. She is a passionate advocate for women’s empowerment and the rights of young people, dedicated to advancing social justice and community resilience.$$),

  ('daniel-mckenzie', 'Daniel McKenzie', 'Director', 'KidzCan Zimbabwe', 'speaker', ARRAY['Daniel McKinzie'], NULL, false, 100,
   $$Daniel McKenzie is the Director of KidzCan Zimbabwe, where he champions paediatric cancer care and advocacy, driven by the belief that no child should die of a treatable cancer simply because of where they were born. Working to bridge the gap between diagnosis and cure, he and his team provide clinical, social, and emotional support so that every child has their “Right to Fight.”$$)
ON CONFLICT (slug) DO UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    organization = EXCLUDED.organization,
    bio = EXCLUDED.bio,
    category = EXCLUDED.category,
    advisor_slug = COALESCE(p.advisor_slug, EXCLUDED.advisor_slug),
    -- keep any spellings already added in /admin/people
    aliases = ARRAY(SELECT DISTINCT unnest(p.aliases || EXCLUDED.aliases));

-- Check the result
SELECT slug, full_name, role, organization, aliases, (bio IS NOT NULL) AS has_bio, (photo_url IS NOT NULL) AS has_photo
FROM public.people
ORDER BY sort_order, full_name;
