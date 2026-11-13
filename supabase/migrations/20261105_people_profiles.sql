-- ==============================================================================
-- People profiles: speakers, moderators, Oak staff and guests shown on /speakers
-- and next to speaker names in the programme.
-- Writes go through the admin API (service role); the public can read published rows.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 200),
    role TEXT,
    organization TEXT,
    bio TEXT,
    photo_url TEXT,
    category TEXT NOT NULL DEFAULT 'speaker' CHECK (category IN ('speaker', 'panelist', 'moderator', 'oak', 'guest')),
    -- Other spellings used in the agenda, e.g. "Doug" for "Douglas Griffiths"
    aliases TEXT[] NOT NULL DEFAULT '{}',
    -- Links the profile to a 1:1 adviser (advisors.slug) so it can offer "Book a 1:1"
    advisor_slug TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_published BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_published_order_idx ON public.people (is_published, sort_order, full_name);

CREATE OR REPLACE FUNCTION public.touch_people_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_touch_updated_at ON public.people;
CREATE TRIGGER people_touch_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.touch_people_updated_at();

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published people are public" ON public.people;
CREATE POLICY "Published people are public" ON public.people
  FOR SELECT TO anon, authenticated USING (is_published);

-- Public bucket for profile photos (uploads go through the admin API)
INSERT INTO storage.buckets (id, name, public)
VALUES ('people-photos', 'people-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Seed everyone named in the 4 Nov agenda. Photos and bios are added from /admin/people.
INSERT INTO public.people (slug, full_name, role, organization, category, advisor_slug, is_featured, sort_order)
VALUES
  ('doug-griffiths', 'Doug Griffiths', 'President', 'Oak Foundation', 'oak', NULL, true, 10),
  ('cheryl-chang', 'Cheryl Chang', 'Chief of Staff', 'Oak Foundation', 'oak', NULL, true, 20),
  ('karl-riber', 'Karl Riber', 'Head of Office, Zimbabwe', 'Oak Foundation', 'oak', NULL, true, 30),
  ('silvia-guizzardi', 'Silvia Guizzardi', NULL, 'Oak Foundation', 'oak', 'silvia-guizzardi', false, 40),
  ('alice-gentile', 'Alice Gentile', 'Adviser - Safeguarding & Organisational Development', 'Oak Foundation', 'oak', 'alice-gentile', false, 50),
  ('michelle-gwatiringa', 'Michelle Gwatiringa', NULL, 'Uncommon', 'moderator', NULL, false, 60),
  ('charity-bafana', 'Charity Bafana', NULL, 'Restless Development', 'speaker', NULL, false, 100),
  ('natalie-simbini', 'Natalie Simbini', NULL, 'Friendship Bench', 'speaker', NULL, false, 100),
  ('rati-moyo', 'Rati Moyo', NULL, 'Childline', 'speaker', NULL, false, 100),
  ('tatenda-songore', 'Tatenda Songore', NULL, 'Youth Advocates', 'speaker', NULL, false, 100),
  ('hillary-tanyanyiwa', 'Hillary Tanyanyiwa', NULL, 'JF Kapnek Zimbabwe', 'speaker', NULL, false, 100),
  ('eleonora-aralla', 'Eleonora Aralla', NULL, 'CAFOD', 'speaker', NULL, false, 100),
  ('tapiwa-chikwana', 'Tapiwa Chikwana', NULL, 'Friendship Bench', 'speaker', NULL, false, 100),
  ('simon-teede', 'Simon Teede', NULL, 'Ele Collection', 'speaker', NULL, false, 100),
  ('lloyd-masunda', 'Lloyd Masunda', NULL, 'SAT', 'speaker', NULL, false, 100),
  ('ngonidzashe-nyambawaro', 'Ngonidzashe Nyambawaro', NULL, 'Island Hospice', 'speaker', NULL, false, 100),
  ('shupikai-chisero', 'Shupikai Chisero', NULL, 'HOSPAZ', 'speaker', NULL, false, 100),
  ('rebecca-gumbo', 'Rebecca Gumbo', NULL, 'Bethany Project', 'speaker', NULL, false, 100),
  ('daniel-mckenzie', 'Daniel McKenzie', NULL, 'KidzCan', 'speaker', NULL, false, 100)
ON CONFLICT (slug) DO NOTHING;
