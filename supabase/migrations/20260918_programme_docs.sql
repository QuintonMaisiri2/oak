BEGIN;
CREATE OR REPLACE FUNCTION public.is_oak_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
      AND lower(email) LIKE '%@uncommon.org');
$$;
REVOKE ALL ON FUNCTION public.is_oak_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_oak_staff() TO authenticated;
-- Standalone migration: safe when the original optional docs table is absent.
CREATE TABLE IF NOT EXISTS public.documentation_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day TEXT NOT NULL,
  notes TEXT NOT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  author_name TEXT,
  author_initials TEXT,
  author_org TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documentation_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documentation_posts FROM anon;
GRANT SELECT, INSERT ON public.documentation_posts TO authenticated;
-- Restrictive policy also constrains any older permissive write policies.
DROP POLICY IF EXISTS "Verified staff docs boundary" ON public.documentation_posts;
CREATE POLICY "Verified staff docs boundary" ON public.documentation_posts AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.is_oak_staff()) WITH CHECK (public.is_oak_staff());
DROP POLICY IF EXISTS "Verified staff docs access" ON public.documentation_posts;
CREATE POLICY "Verified staff docs access" ON public.documentation_posts
  FOR ALL TO authenticated
  USING (public.is_oak_staff()) WITH CHECK (public.is_oak_staff());
CREATE INDEX IF NOT EXISTS idx_documentation_created_at ON public.documentation_posts (created_at DESC);
COMMIT;
