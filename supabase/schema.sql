-- ==============================================================================
-- OAK Zimbabwe Partner Gathering — Complete Supabase Database Schema
-- Venue: Cresta Lodge, Harare · 9–11 November 2026
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ATTENDEES TABLE
CREATE TABLE IF NOT EXISTS public.attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    organization TEXT NOT NULL,
    sub_partner TEXT,
    role TEXT NOT NULL CHECK (role IN ('Grantee', 'Partner', 'OAK Staff', 'Coordination Team', 'Presenter', 'Observer')),
    email TEXT NOT NULL,
    phone TEXT,
    dietary TEXT,
    accessibility TEXT,
    travel_needs TEXT,
    accommodation TEXT,
    consent_given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick QR code / event code lookup
CREATE INDEX IF NOT EXISTS idx_attendees_event_code ON public.attendees (event_code);
CREATE INDEX IF NOT EXISTS idx_attendees_email ON public.attendees (email);

-- 3. CHECK-INS TABLE (Strict Idempotency Constraint R8)
CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendee_id UUID NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
    event_day DATE NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scanned_by_admin_id UUID,
    CONSTRAINT uq_attendee_event_day UNIQUE (attendee_id, event_day)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_event_day ON public.check_ins (event_day);
CREATE INDEX IF NOT EXISTS idx_check_ins_attendee_id ON public.check_ins (attendee_id);

-- 4. PROGRAMME SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day TEXT NOT NULL, -- e.g. 'day-1', 'day-2', 'day-3'
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration TEXT,
    title TEXT NOT NULL,
    speaker TEXT,
    location TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Plenary', 'Breakout', 'Workshop', 'Social')),
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_day ON public.sessions (day);

-- 5. DOCUMENTATION POSTS TABLE
CREATE TABLE IF NOT EXISTS public.documentation_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day TEXT NOT NULL,
    notes TEXT NOT NULL,
    photo_urls TEXT[] DEFAULT '{}',
    author_name TEXT,
    author_initials TEXT,
    author_org TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentation_day ON public.documentation_posts (day);

-- 6. PARTNERS DIRECTORY TABLE
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo TEXT NOT NULL,
    region TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    since TEXT,
    website TEXT NOT NULL,
    is_sub_partner BOOLEAN DEFAULT false,
    parent_org_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_region ON public.partners (region);

-- ==============================================================================
-- 7. PUBLIC-SAFE PROJECTION VIEW (Hard Rules R1, R2, R3)
-- Excludes sensitive columns: email, phone, dietary, accessibility, travel_needs
-- ==============================================================================
CREATE OR REPLACE VIEW public.attendees_public AS
SELECT
    id,
    event_code,
    first_name,
    last_name,
    name,
    organization,
    sub_partner,
    role,
    created_at
FROM public.attendees;

-- Grant read access on public view to anon and authenticated
GRANT SELECT ON public.attendees_public TO anon, authenticated;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentation_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Attendees Policies:
-- 1. Anyone can register (INSERT) with consent
CREATE POLICY "Public registration allowed"
    ON public.attendees
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (consent_given_at IS NOT NULL);

-- 2. Only authenticated admins can directly SELECT full attendee records
CREATE POLICY "Admin full attendee read access"
    ON public.attendees
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Only authenticated admins can UPDATE or DELETE attendees
CREATE POLICY "Admin attendee update access"
    ON public.attendees
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admin attendee delete access"
    ON public.attendees
    FOR DELETE
    TO authenticated
    USING (true);

-- Check-Ins Policies:
CREATE POLICY "Admin check_in read access"
    ON public.check_ins
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admin check_in write access"
    ON public.check_ins
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Sessions Policies (Public read, admin write):
CREATE POLICY "Public sessions read"
    ON public.sessions
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admin sessions write"
    ON public.sessions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Documentation Posts Policies (Public read, admin write):
CREATE POLICY "Public documentation read"
    ON public.documentation_posts
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admin documentation write"
    ON public.documentation_posts
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Partners Policies (Public read, admin write):
CREATE POLICY "Public partners read"
    ON public.partners
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admin partners write"
    ON public.partners
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- 9. INITIAL SEED DATA
-- ==============================================================================

-- Sessions Seed
INSERT INTO public.sessions (day, start_time, end_time, duration, title, speaker, location, category, is_featured)
VALUES
    ('day-1', '09:00', '10:30', '90 min', 'Opening Plenary: Collective Vision for Zimbabwe', 'Welcome Address & Keynote Panel', 'Main Hall A', 'Plenary', true),
    ('day-1', '10:50', '12:00', '-12:00', 'Thematic Dialogue: Climate Justice & Grantmaking', 'Samuel Okafor · Africa Climate Alliance', 'Conference Room B2', 'Breakout', false),
    ('day-1', '10:50', '12:00', '-12:00', 'Workshop: Measuring Long-term Change', 'Dr. Ingrid Holm · Nordic Evaluation Centre', 'Workshop Room C', 'Workshop', false),
    ('day-1', '13:30', '14:30', '-14:30', 'Partner Spotlight: Rights-Based Approaches', 'Fatima Zahra Benali · MENA Rights Group', 'Main Hall A', 'Plenary', false),
    ('day-1', '14:45', '16:00', '-16:00', 'Digital Rights in Authoritarian Contexts', 'Li Wei · Digital Frontiers Institute', 'Conference Room B1', 'Breakout', false),
    ('day-1', '18:00', '20:00', '-20:00', 'Welcome Reception & Dinner', NULL, 'Rooftop Terrace', 'Social', false),
    ('day-2', '09:00', '10:30', '90 min', 'Day 2 Plenary: Civic Space & Community Resilience', 'Panel Discussion', 'Main Hall A', 'Plenary', true),
    ('day-2', '11:00', '12:30', '-12:30', 'Cross-Movement Solidarity & Resource Mobilisation', 'Tariro Moyo · Zimbabwe Civic Coalition', 'Conference Room B1', 'Breakout', false),
    ('day-2', '14:00', '15:30', '-15:30', 'Technology & Narrative Power in Activism', 'Global Advocacy Lab', 'Workshop Room C', 'Workshop', false),
    ('day-3', '09:30', '11:00', '90 min', 'Closing Plenary: Next Steps & Joint Action Commitments', 'Working Group Rapporteurs', 'Main Hall A', 'Plenary', true)
ON CONFLICT DO NOTHING;

-- Documentation Posts Seed
INSERT INTO public.documentation_posts (day, notes, photo_urls, author_name, author_initials, author_org)
VALUES
    ('day-1', 'The rights-based approaches session surfaced strong demand for a shared learning platform. OSF will follow up with MENA Rights Group on joint programming opportunities in the Mediterranean region.', ARRAY['/programme/photo-1.jpg', '/programme/photo-2.jpg'], 'Maria Schmidt', 'MS', 'Open Society Foundations'),
    ('day-1', 'Digital Rights breakout: participants want a working group to share tools for operating in restricted digital environments. Interested orgs: Digital Frontiers, Access Now, EFF.', ARRAY['/programme/photo-3.jpg'], 'James Odhiambo', 'JO', 'OAK Foundation')
ON CONFLICT DO NOTHING;

-- Partners Seed
INSERT INTO public.partners (name, logo, region, tags, since, website, is_sub_partner)
VALUES
    ('Open Society Foundations', 'OSF', 'Global', ARRAY['Foundation', 'Democracy', 'Human Rights'], '2018', 'opensocietyfoundations.org', true),
    ('Africa Climate Alliance', 'ACA', 'Sub-Saharan Africa', ARRAY['NGO', 'Climate Justice', 'Youth Advocacy'], '2020', 'africaclimatealliance.org', true),
    ('Nordic Evaluation Centre', 'NEC', 'Northern Europe', ARRAY['Research', 'Evaluation', 'Learning'], '2021', 'nordicevaluation.org', true),
    ('MENA Rights Group', 'MRG', 'Middle East & North Africa', ARRAY['NGO', 'Human Rights', 'Documentation'], '2019', 'menarights.org', false),
    ('Digital Frontiers Institute', 'DFI', 'Global / East Africa', ARRAY['Research', 'Digital Rights', 'Internet Freedom'], '2022', 'digitalfrontiers.org', false),
    ('Global Advocacy Lab', 'GAL', 'Global', ARRAY['NGO', 'Communications', 'Campaigns'], '2023', 'globaladvocacylab.org', false),
    ('Sciences Po Paris', 'SP', 'Western Europe', ARRAY['Academic', 'Research', 'Policy'], '2020', 'sciencespo.fr', false),
    ('Environmental Funders Group', 'EFG', 'Europe', ARRAY['Network', 'Environment', 'Climate'], '2017', 'envfunders.eu', false)
ON CONFLICT DO NOTHING;
