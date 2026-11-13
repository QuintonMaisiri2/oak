-- Add email_error column to bookings table to store email dispatch error details
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_error TEXT;

COMMENT ON COLUMN bookings.email_error IS 'Stores error messages or failure diagnostics from email providers (Resend or SMTP).';
