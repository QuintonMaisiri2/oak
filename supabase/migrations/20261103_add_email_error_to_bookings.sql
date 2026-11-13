-- ==============================================================================
-- Add email_error column to bookings table to record delivery diagnostic errors
-- ==============================================================================

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS email_error TEXT;

COMMENT ON COLUMN public.bookings.email_error IS 'Detailed error message returned by email provider (SMTP/Resend) when email dispatch fails';
