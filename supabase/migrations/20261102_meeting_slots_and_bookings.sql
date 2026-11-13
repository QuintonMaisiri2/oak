-- ==============================================================================
-- Meeting Slots and Bookings Schema
-- ==============================================================================

-- 1. SLOTS TABLE
CREATE TABLE IF NOT EXISTS public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. BOOKINGS TABLE (Atomic 1:1 constraint via unique slot_id)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL UNIQUE REFERENCES public.slots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    organisation TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_slots_start_time ON public.slots(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON public.bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON public.bookings(email);

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Anonymous users may read all slots
DROP POLICY IF EXISTS "Allow anonymous read on slots" ON public.slots;
CREATE POLICY "Allow anonymous read on slots" ON public.slots
    FOR SELECT
    USING (true);

-- Anonymous users cannot directly query or manipulate bookings table
-- Inserts, updates, and admin reads are handled via service role key in API routes / server actions.

-- 5. SEED INITIAL 8 SLOTS (Year 2026, SAST / CAT: UTC+2)
INSERT INTO public.slots (start_time, end_time, duration_minutes, note) VALUES
('2026-11-09T17:10:00+02:00', '2026-11-09T17:40:00+02:00', 30, NULL),
('2026-11-09T17:40:00+02:00', '2026-11-09T18:10:00+02:00', 30, NULL),
('2026-11-10T10:00:00+02:00', '2026-11-10T10:30:00+02:00', 30, 'Chat during tea break'),
('2026-11-10T13:55:00+02:00', '2026-11-10T14:15:00+02:00', 20, NULL),
('2026-11-10T16:40:00+02:00', '2026-11-10T17:00:00+02:00', 20, NULL),
('2026-11-10T17:00:00+02:00', '2026-11-10T17:20:00+02:00', 20, NULL),
('2026-11-11T08:15:00+02:00', '2026-11-11T08:45:00+02:00', 30, NULL),
('2026-11-11T10:30:00+02:00', '2026-11-11T11:00:00+02:00', 30, 'Chat during tea break');
