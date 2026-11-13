BEGIN;

CREATE TABLE IF NOT EXISTS public.documentation_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  notes TEXT NOT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  author_name TEXT,
  author_initials TEXT,
  author_org TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documentation_posts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.documentation_posts ALTER COLUMN photo_urls SET DEFAULT '{}';
ALTER TABLE public.documentation_posts ALTER COLUMN created_at SET DEFAULT now();

-- NOT VALID preserves legacy/sample rows, while enforcing these rules on new writes.
-- Existing unowned notes remain unowned; do not assign them to an arbitrary user.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.documentation_posts'::regclass AND conname = 'documentation_note_fields') THEN
    ALTER TABLE public.documentation_posts ADD CONSTRAINT documentation_note_fields CHECK (
      user_id IS NOT NULL
      AND day IN ('Day 1', 'Day 2', 'Day 3')
      AND char_length(btrim(notes)) BETWEEN 1 AND 5000
      AND author_name IS NOT NULL AND char_length(btrim(author_name)) BETWEEN 1 AND 100
      AND author_initials IS NOT NULL AND char_length(author_initials) BETWEEN 1 AND 10
      AND author_org IS NOT NULL AND char_length(btrim(author_org)) BETWEEN 1 AND 200
      AND photo_urls IS NOT NULL AND cardinality(photo_urls) <= 1
      AND (cardinality(photo_urls) = 0 OR (
        photo_urls[1] IS NOT NULL AND char_length(photo_urls[1]) <= 2048
        AND photo_urls[1] ~ '^https://[^[:space:]]+$'
        AND photo_urls[1] !~ '^https://[^/]*@'
      ))
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.documentation_posts'::regclass AND contype = 'f' AND confrelid = 'auth.users'::regclass) THEN
    ALTER TABLE public.documentation_posts ADD CONSTRAINT documentation_posts_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

ALTER TABLE public.documentation_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documentation_posts FROM anon;
GRANT SELECT, INSERT ON public.documentation_posts TO authenticated;
-- Replace legacy public/staff policies with the personal-note ownership model.
DO $$ DECLARE existing record;
BEGIN
  FOR existing IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documentation_posts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.documentation_posts', existing.policyname);
  END LOOP;
END $$;
CREATE POLICY "Read own programme notes" ON public.documentation_posts
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Add own programme notes" ON public.documentation_posts
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE INDEX IF NOT EXISTS documentation_posts_owner_created ON public.documentation_posts(user_id, created_at DESC);
COMMIT;
