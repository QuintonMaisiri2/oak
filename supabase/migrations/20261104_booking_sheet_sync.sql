-- ==============================================================================
-- Add Google Sheets webhook sync tracking columns to bookings
-- ==============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sheet_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sheet_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ;

-- Optional check constraint ensuring valid sync status values
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

CREATE INDEX IF NOT EXISTS idx_bookings_sheet_sync_status
  ON public.bookings(sheet_sync_status);

COMMENT ON COLUMN public.bookings.cancelled_at IS 'Timestamp when the booking was cancelled (if status = cancelled)';
COMMENT ON COLUMN public.bookings.sheet_sync_status IS 'Google Sheet webhook sync status: pending, synced, or failed';
COMMENT ON COLUMN public.bookings.sheet_sync_error IS 'Sanitized error message from the last failed Google Sheet webhook sync attempt';
COMMENT ON COLUMN public.bookings.sheet_synced_at IS 'Timestamp when the booking was last successfully synced to Google Sheets';
