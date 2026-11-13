-- =============================================================================
-- Migration: 20261104_auth_audit_and_allowlist.sql
-- Purpose:
--   1. Normalise all existing email addresses in attendees, admin_users, and bookings
--      to lowercase and trimmed.
--   2. Add Alice Gentile (alice.gentile@oakfnd.ch) to the explicit attendees allow-list.
--   3. Create audit_log (and audit_logs view/table compatibility) with structured
--      sign-in audit fields: reason, ip_address, user_agent, request_id, details.
-- =============================================================================

-- 1. Normalise existing emails to lowercase + trimmed
UPDATE public.attendees
SET email = LOWER(BTRIM(email))
WHERE email IS NOT NULL AND email <> LOWER(BTRIM(email));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    UPDATE public.admin_users
    SET email = LOWER(BTRIM(email))
    WHERE email IS NOT NULL AND email <> LOWER(BTRIM(email));
  END IF;
END $$;

-- 2. Ensure alice.gentile@oakfnd.ch is in the explicit attendees allow-list
INSERT INTO public.attendees (
  event_code,
  first_name,
  last_name,
  organization,
  role,
  email
)
SELECT
  'OAK-2026-1104-ALGE',
  'Alice',
  'Gentile',
  'OAK Foundation',
  'OAK Staff',
  'alice.gentile@oakfnd.ch'
WHERE NOT EXISTS (
  SELECT 1 FROM public.attendees
  WHERE LOWER(BTRIM(email)) = 'alice.gentile@oakfnd.ch'
);

-- 3. Create public.audit_log table for sign-in and admin audit logging
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_email TEXT,
  target_email TEXT,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns if audit_log already existed with fewer columns
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_email ON public.audit_log (actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON public.audit_log (request_id);

-- Also ensure public.audit_logs table exists for backward compatibility
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_email TEXT,
  target_email TEXT,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
