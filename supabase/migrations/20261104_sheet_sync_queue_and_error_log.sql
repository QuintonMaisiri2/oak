-- Migration: Add slot sheet row mapping, persistent sheet_sync_queue, and error_log
-- Date: 2026-11-04

-- 1. Add sheet_row_index and external_slot_id to public.slots
ALTER TABLE public.slots
  ADD COLUMN IF NOT EXISTS sheet_row_index INTEGER,
  ADD COLUMN IF NOT EXISTS external_slot_id TEXT;

-- Populate deterministic sheet_row_index (Row 2..N, since Row 1 is headers) ordered chronologically
WITH ranked_slots AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY advisor_id ORDER BY start_time ASC, id ASC) AS seq
  FROM public.slots
)
UPDATE public.slots s
SET
  sheet_row_index = COALESCE(s.sheet_row_index, r.seq + 1),
  external_slot_id = COALESCE(s.external_slot_id, 'OAK-SESS-' || (100 + r.seq)::text)
FROM ranked_slots r
WHERE s.id = r.id;

-- 2. Ensure bookings has sheet_sync_* and cancelled_at columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sheet_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sheet_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_sheet_sync_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_sheet_sync_status_check
      CHECK (sheet_sync_status IN ('pending', 'synced', 'failed'));
  END IF;
END $$;

-- 3. Create persistent sheet_sync_queue table for scheduled background retries with exponential backoff
CREATE TABLE IF NOT EXISTS public.sheet_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES public.slots(id) ON DELETE SET NULL,
  sheet_row_index INTEGER,
  action TEXT NOT NULL DEFAULT 'upsert',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'synced', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sheet_sync_queue_booking_id_key UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_sheet_sync_queue_status_next_retry
  ON public.sheet_sync_queue (status, next_retry_at);

-- 4. Create error_log table for capturing sheet sync & system errors with Super Admin dashboard alerting
CREATE TABLE IF NOT EXISTS public.error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'sheets_sync',
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  slot_id UUID REFERENCES public.slots(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_log_unresolved_created
  ON public.error_log (resolved, created_at DESC);
