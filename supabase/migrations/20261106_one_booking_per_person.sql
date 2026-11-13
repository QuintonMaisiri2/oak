-- One confirmed 1:1 booking per person in total, across all advisers.
-- The booking API checks this first; this index makes it impossible even when two
-- requests arrive at the same moment.
--
-- BEFORE RUNNING: people who already hold more than one confirmed booking stop this
-- index from being created. Find them with:
--
--   SELECT lower(email) AS email, count(*) AS bookings,
--          array_agg(id ORDER BY created_at) AS booking_ids
--   FROM public.bookings
--   WHERE status = 'confirmed'
--   GROUP BY lower(email)
--   HAVING count(*) > 1;
--
-- then cancel all but one for each person from /admin/bookings (Cancel frees the slot).

-- Stored emails are lowercased by the API; normalise any older rows to match.
UPDATE public.bookings SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_per_person
  ON public.bookings (lower(email))
  WHERE status = 'confirmed';
