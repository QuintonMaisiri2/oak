-- Adds "panelist" as a profile type alongside speaker, moderator, Oak Foundation and guest.
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_category_check;
ALTER TABLE public.people
  ADD CONSTRAINT people_category_check
  CHECK (category IN ('speaker', 'panelist', 'moderator', 'oak', 'guest'));

-- Optional: mark the Day 2 morning panel (from the speaker profiles PDF) as panelists.
-- UPDATE public.people SET category = 'panelist'
-- WHERE slug IN ('charity-bafana', 'natalie-simbini', 'rati-moyo', 'tatenda-songore');
