-- ==============================================================================
-- OAK Multi-Advisor Clinics & Booking Upgrades
-- ==============================================================================

-- 1. ADVISORS TABLE
CREATE TABLE IF NOT EXISTS public.advisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    bio TEXT NOT NULL,
    photo_url TEXT,
    email TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. UPDATE SLOTS TABLE
ALTER TABLE public.slots ADD COLUMN IF NOT EXISTS advisor_id UUID REFERENCES public.advisors(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_slots_advisor_id ON public.slots(advisor_id);

-- 3. UPDATE BOOKINGS TABLE
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancel_token TEXT UNIQUE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'pending';

-- Update slot uniqueness to support cancellation & rebooking
-- Drop full unique constraint if exists, and use partial unique index where status = 'confirmed'
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_slot_id_key;
DROP INDEX IF EXISTS idx_bookings_active_slot;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot ON public.bookings(slot_id) WHERE status = 'confirmed';

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous read on active advisors" ON public.advisors;
CREATE POLICY "Allow anonymous read on active advisors" ON public.advisors
    FOR SELECT
    USING (is_active = true);

-- 5. SEED FIRST ADVISOR: SILVIA GUIZZARDI
INSERT INTO public.advisors (slug, full_name, job_title, bio, email, is_active)
VALUES (
    'silvia-guizzardi',
    'Silvia Guizzardi',
    'Senior Adviser for Impact',
    'Silvia focuses on Impact and MEL (Monitoring, Evaluation and Learning). You can take the opportunity to meet with her and discuss any aspect of your MEL work and needs, regardless of where you are on your MEL journey. Whether you need feedback on an existing theory of change, results framework or MEL plan, support to develop one, or advice on meeting donor reporting requirements and demonstrating and communicating the impact of your work, she offers a space for practical, tailored guidance. You can discuss how to strengthen your impact stories with credible and feasible evidence, discuss plans for commissioning an external evaluation, seek clarification on reporting requirements, or learn about resources and support available to enhance your MEL capacity.

The clinic is intended as the start of an ongoing conversation. While it may not be possible to address every question during the session itself, Silvia will be available for follow-up discussions to ensure your MEL needs and challenges are fully supported.',
    'silvia.guizzardi@oakfnd.ch',
    true
)
ON CONFLICT (slug) DO UPDATE
SET full_name = EXCLUDED.full_name,
    job_title = EXCLUDED.job_title,
    bio = EXCLUDED.bio,
    email = EXCLUDED.email,
    is_active = EXCLUDED.is_active;

-- 6. LINK ALL EXISTING SLOTS TO SILVIA
UPDATE public.slots
SET advisor_id = (SELECT id FROM public.advisors WHERE slug = 'silvia-guizzardi' LIMIT 1)
WHERE advisor_id IS NULL;
