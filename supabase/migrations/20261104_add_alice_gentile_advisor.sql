-- ==============================================================================
-- Add Alice Gentile (Safeguarding & Organisational Development clinics) and her slots
-- Source: "Booking time with Oak staff" sheet, 4 Nov 2026. Times are CAT (UTC+2).
-- ==============================================================================

INSERT INTO public.advisors (slug, full_name, job_title, bio, email, is_active)
VALUES (
    'alice-gentile',
    'Alice Gentile',
    'Adviser - Safeguarding & Organisational Development',
    'Take the opportunity to book a 30-minute Safeguarding and/or Organisational Development Clinic with Alice Gentile. Whether you are new to these topics or have already engaged in safeguarding or organisational strengthening work, the clinic offers a chance to discuss organisational needs, learn about available approaches and resources, and identify practical next steps.
For organisations that have previously worked with Oak''s OSE team, the clinic also provides an opportunity to reflect on progress and explore what next. Alice will convey any pending questions to Adriana when back in Geneva, and both Adriana and Alice will be available for follow-up discussions and referrals to relevant resources and support.',
    'alice.gentile@oakfnd.ch',
    true
)
ON CONFLICT (slug) DO UPDATE
SET full_name = EXCLUDED.full_name,
    job_title = EXCLUDED.job_title,
    bio = EXCLUDED.bio,
    email = EXCLUDED.email,
    is_active = EXCLUDED.is_active;

-- Seed slots only once (re-running this migration must not duplicate them)
INSERT INTO public.slots (advisor_id, start_time, end_time, duration_minutes, note)
SELECT a.id, s.start_time, s.end_time, s.duration_minutes, NULL
FROM public.advisors a
CROSS JOIN (VALUES
    ('2026-11-09T17:10:00+02:00'::timestamptz, '2026-11-09T17:40:00+02:00'::timestamptz, 30),
    ('2026-11-09T17:40:00+02:00'::timestamptz, '2026-11-09T18:10:00+02:00'::timestamptz, 30),
    ('2026-11-09T18:10:00+02:00'::timestamptz, '2026-11-09T18:40:00+02:00'::timestamptz, 30),
    ('2026-11-10T10:00:00+02:00'::timestamptz, '2026-11-10T10:30:00+02:00'::timestamptz, 30),
    ('2026-11-10T13:45:00+02:00'::timestamptz, '2026-11-10T14:15:00+02:00'::timestamptz, 30),
    ('2026-11-10T16:45:00+02:00'::timestamptz, '2026-11-10T17:15:00+02:00'::timestamptz, 30),
    ('2026-11-11T08:00:00+02:00'::timestamptz, '2026-11-11T08:30:00+02:00'::timestamptz, 30),
    ('2026-11-11T10:30:00+02:00'::timestamptz, '2026-11-11T11:00:00+02:00'::timestamptz, 30)
) AS s(start_time, end_time, duration_minutes)
WHERE a.slug = 'alice-gentile'
  AND NOT EXISTS (SELECT 1 FROM public.slots existing WHERE existing.advisor_id = a.id);
