-- Apply after schema.sql and before deploying the security changes.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_oak_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
      AND lower(email) LIKE '%@uncommon.org');
$$;
REVOKE ALL ON FUNCTION public.is_oak_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_oak_staff() TO authenticated;

-- Remove permissive legacy policies; RLS policies combine with OR by default.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('attendees', 'check_ins')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendees, public.check_ins FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendees, public.check_ins TO authenticated;
CREATE POLICY staff_attendees ON public.attendees FOR ALL TO authenticated
  USING (public.is_oak_staff()) WITH CHECK (public.is_oak_staff());
CREATE POLICY staff_check_ins ON public.check_ins FOR ALL TO authenticated
  USING (public.is_oak_staff()) WITH CHECK (public.is_oak_staff());

-- Some deployments omit these optional feature tables. IF EXISTS on a policy
-- only tolerates a missing policy, not a missing table, so check the table first.
DO $$
DECLARE feature record;
BEGIN
  FOR feature IN SELECT * FROM (VALUES
    ('sessions', 'Admin sessions write'),
    ('documentation_posts', 'Admin documentation write'),
    ('partners', 'Admin partners write')
  ) AS features(table_name, policy_name)
  LOOP
    IF to_regclass(format('public.%I', feature.table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', feature.table_name);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', feature.policy_name, feature.table_name);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_oak_staff()) WITH CHECK (public.is_oak_staff())',
        feature.policy_name, feature.table_name
      );
    END IF;
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS private.registration_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret_hash text NOT NULL CHECK (length(secret_hash) = 64)
);
CREATE TABLE IF NOT EXISTS private.registration_limits (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL
);
REVOKE ALL ON private.registration_config, private.registration_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_public_attendee(
  p_secret text, p_rate_key text, p_event_code text, p_input jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_bucket text;
  v_count integer;
  v_limit integer;
  v_id uuid;
BEGIN
  -- Anonymous key may call this function, but only our server knows the gateway secret.
  IF p_secret IS NULL OR length(p_secret) < 32 OR length(p_secret) > 512 OR NOT EXISTS (
    SELECT 1 FROM private.registration_config
    WHERE secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'unavailable');
  END IF;
  IF p_rate_key IS NULL OR p_rate_key !~ '^[a-f0-9]{64}$'
    OR p_event_code IS NULL OR p_event_code !~ '^OAK-2026-[0-9]{4}-[A-Z0-9]{4}$'
    OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' OR octet_length(p_input::text) > 16000
  THEN RETURN jsonb_build_object('success', false, 'code', 'invalid_input'); END IF;

  -- Reject unexpected keys and types even if called outside the Next.js action.
  IF EXISTS (SELECT 1 FROM jsonb_each(p_input) e
    WHERE e.key <> ALL(ARRAY['firstName','lastName','organization','subPartner','email','phone','role','dietary','accessibility','travel','accommodation','consent'])
       OR (e.key <> 'consent' AND jsonb_typeof(e.value) <> 'string'))
    OR p_input->'consent' IS DISTINCT FROM 'true'::jsonb
    OR coalesce(length(trim(p_input->>'firstName')), 0) NOT BETWEEN 2 AND 100
    OR coalesce(length(trim(p_input->>'lastName')), 0) NOT BETWEEN 2 AND 100
    OR coalesce(length(trim(p_input->>'organization')), 0) NOT BETWEEN 2 AND 200
    OR coalesce(length(p_input->>'subPartner'), 0) > 200
    OR coalesce(length(p_input->>'email'), 0) NOT BETWEEN 3 AND 254
    OR coalesce(p_input->>'email', '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR coalesce(p_input->>'role', '') <> ALL(ARRAY['Partner','OAK Staff','Coordination Team','Presenter','Observer'])
    OR (coalesce(length(p_input->>'phone'), 0) <> 0 AND length(p_input->>'phone') NOT BETWEEN 5 AND 40)
    OR coalesce(length(p_input->>'dietary'), 0) > 1000
    OR coalesce(length(p_input->>'accessibility'), 0) > 1000
    OR coalesce(length(p_input->>'travel'), 0) > 1000
    OR coalesce(length(p_input->>'accommodation'), 0) > 1000
  THEN RETURN jsonb_build_object('success', false, 'code', 'invalid_input'); END IF;

  v_email := lower(trim(p_input->>'email'));
  -- Atomic per-IP and per-email limits shared by every app instance.
  -- Counters commit on rejected requests (return a value, never raise an exception).
  FOREACH v_bucket IN ARRAY ARRAY[
    'ip:' || p_rate_key,
    'email:' || encode(sha256(convert_to(v_email, 'UTF8')), 'hex')
  ] LOOP
    v_limit := CASE WHEN v_bucket LIKE 'ip:%' THEN 10 ELSE 3 END;
    INSERT INTO private.registration_limits AS limits (bucket, window_start, attempts)
      VALUES (v_bucket, clock_timestamp(), 1)
    ON CONFLICT (bucket) DO UPDATE SET
      window_start = CASE WHEN limits.window_start < clock_timestamp() - interval '15 minutes' THEN clock_timestamp() ELSE limits.window_start END,
      attempts = CASE WHEN limits.window_start < clock_timestamp() - interval '15 minutes' THEN 1 ELSE limits.attempts + 1 END
    RETURNING attempts INTO v_count;
    IF v_count > v_limit THEN
      RETURN jsonb_build_object('success', false, 'code', 'rate_limited');
    END IF;
  END LOOP;

  -- The email rate-limit row lock serializes concurrent registrations for one email.
  IF EXISTS (SELECT 1 FROM public.attendees WHERE lower(trim(email)) = v_email) THEN
    RETURN jsonb_build_object('success', false, 'code', 'already_registered');
  END IF;
  BEGIN
    INSERT INTO public.attendees (
      event_code, first_name, last_name, organization, sub_partner, role, email,
      phone, dietary, accessibility, travel_needs, accommodation, consent_given_at
    ) VALUES (
      p_event_code, trim(p_input->>'firstName'), trim(p_input->>'lastName'),
      trim(p_input->>'organization'), nullif(trim(p_input->>'subPartner'), ''), p_input->>'role',
      v_email, nullif(trim(p_input->>'phone'), ''), nullif(trim(p_input->>'dietary'), ''),
      nullif(trim(p_input->>'accessibility'), ''), nullif(trim(p_input->>'travel'), ''),
      nullif(trim(p_input->>'accommodation'), ''), clock_timestamp()
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'retry');
  END;
  RETURN jsonb_build_object('success', true, 'attendeeId', v_id, 'eventCode', p_event_code);
END;
$$;
REVOKE ALL ON FUNCTION public.register_public_attendee(text,text,text,jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.register_public_attendee(text,text,text,jsonb) TO anon;
COMMIT;
