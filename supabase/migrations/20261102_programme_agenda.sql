-- Editable programme agenda.
-- The whole agenda is stored as one JSON document (ordered days → ordered items) so
-- staff edits are saved atomically and the public page, PDF and editor share one shape.
-- Until a row exists the app falls back to the built-in agenda in src/components/programme/data.ts.
CREATE TABLE IF NOT EXISTS public.programme_agenda (
  id TEXT PRIMARY KEY DEFAULT 'main' CHECK (id = 'main'),
  days JSONB NOT NULL CHECK (jsonb_typeof(days) = 'array'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email TEXT
);

-- Previous versions, kept automatically so a bad save can be rolled back.
CREATE TABLE IF NOT EXISTS public.programme_agenda_revisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  days JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL,
  saved_by UUID,
  saved_by_email TEXT,
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.archive_programme_agenda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.programme_agenda_revisions (days, saved_at, saved_by, saved_by_email)
  VALUES (OLD.days, OLD.updated_at, OLD.updated_by, OLD.updated_by_email);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_programme_agenda() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS programme_agenda_archive ON public.programme_agenda;
CREATE TRIGGER programme_agenda_archive
  BEFORE UPDATE ON public.programme_agenda
  FOR EACH ROW EXECUTE FUNCTION public.archive_programme_agenda();

ALTER TABLE public.programme_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_agenda_revisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.programme_agenda FROM anon, authenticated;
REVOKE ALL ON public.programme_agenda_revisions FROM anon, authenticated;
GRANT SELECT ON public.programme_agenda TO anon, authenticated;
GRANT INSERT, UPDATE ON public.programme_agenda TO authenticated;
GRANT SELECT ON public.programme_agenda_revisions TO authenticated;

DROP POLICY IF EXISTS "Agenda is public" ON public.programme_agenda;
CREATE POLICY "Agenda is public" ON public.programme_agenda
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff create agenda" ON public.programme_agenda;
CREATE POLICY "Staff create agenda" ON public.programme_agenda
  FOR INSERT TO authenticated WITH CHECK (public.is_oak_staff());

DROP POLICY IF EXISTS "Staff edit agenda" ON public.programme_agenda;
CREATE POLICY "Staff edit agenda" ON public.programme_agenda
  FOR UPDATE TO authenticated USING (public.is_oak_staff()) WITH CHECK (public.is_oak_staff());

DROP POLICY IF EXISTS "Staff read agenda history" ON public.programme_agenda_revisions;
CREATE POLICY "Staff read agenda history" ON public.programme_agenda_revisions
  FOR SELECT TO authenticated USING (public.is_oak_staff());
