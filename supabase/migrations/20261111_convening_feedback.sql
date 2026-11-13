-- Anonymous convening feedback (the end-of-convening feedback form).
--
-- Anonymous by design: there is no user_id, name, email or organisation column, and only the
-- submission DATE is stored (no time of day), so a response cannot be matched to a person by
-- when they signed in. Rows are written and read only by the server (service role); RLS is on
-- with no policies, so the public anon key can neither read nor write this table.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.convening_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_on  date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Harare')::date,
  overall       smallint NOT NULL CHECK (overall BETWEEN 1 AND 5),
  objectives    jsonb NOT NULL DEFAULT '{}'::jsonb,
  sessions      jsonb NOT NULL DEFAULT '{}'::jsonb,
  arrangements  jsonb NOT NULL DEFAULT '{}'::jsonb,
  tracks        text[] NOT NULL DEFAULT '{}',
  experience    text CHECK (experience IS NULL OR char_length(experience) <= 3000),
  improvements  text CHECK (improvements IS NULL OR char_length(improvements) <= 3000),
  most_valuable text CHECK (most_valuable IS NULL OR char_length(most_valuable) <= 3000)
);

ALTER TABLE public.convening_feedback ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: only the service role (server API) can access this table.
REVOKE ALL ON public.convening_feedback FROM anon, authenticated;
