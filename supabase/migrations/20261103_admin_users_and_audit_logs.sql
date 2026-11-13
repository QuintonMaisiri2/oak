-- ==============================================================================
-- OAK Admin Access & Audit Logs Migration
-- ==============================================================================

-- 1. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
    team TEXT NOT NULL DEFAULT 'Coordination Team',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT admin_users_email_domain_check 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@(oakfnd\.org|oakfnd\.ch|uncommon\.org)$')
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(is_active);

-- 2. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_email TEXT,
    target_email TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view active admin records for authorization verification
DROP POLICY IF EXISTS "Allow active admins read access" ON public.admin_users;
CREATE POLICY "Allow active admins read access" ON public.admin_users
    FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Service role has full management access to audit_logs
DROP POLICY IF EXISTS "Service role audit log access" ON public.audit_logs;
CREATE POLICY "Service role audit log access" ON public.audit_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- 4. SEED ADMIN USERS (IDEMPOTENT UPSERT)
INSERT INTO public.admin_users (email, full_name, role, team, is_active)
VALUES
    -- Super Admin
    ('vincent@uncommon.org', 'Vincent Mugondora', 'super_admin', 'Coordination Team', true),
    
    -- Uncommon (role: admin, team: Coordination Team)
    ('tapiwa.chikwanha@uncommon.org', 'Tapiwa Chikwanha', 'admin', 'Coordination Team', true),
    ('walter@uncommon.org', 'Walter Gombarume', 'admin', 'Coordination Team', true),
    ('michelle.gwatiringa@uncommon.org', 'Michelle Gwatiringa', 'admin', 'Coordination Team', true),
    ('tanatswa@uncommon.org', 'Tanatswa Lionde', 'admin', 'Coordination Team', true),
    ('kirsty@uncommon.org', 'Kirsty Matyukira', 'admin', 'Coordination Team', true),
    ('farayi@uncommon.org', 'Farayi Nyamayaro', 'admin', 'Coordination Team', true),
    ('elisha.urombo@uncommon.org', 'Elisha Urombo', 'admin', 'Coordination Team', true),
    ('beyond@uncommon.org', 'Beyond Bechani', 'admin', 'Coordination Team', true),
    ('comms@uncommon.org', 'Oak Comms', 'admin', 'Coordination Team', true),

    -- OAK (role: admin, team: OAK)
    ('karl.riber@oakfnd.org', 'Karl Riber', 'admin', 'OAK', true),
    ('adriana.craciun@oakfnd.ch', 'Adriana Craciun', 'admin', 'OAK', true),
    ('merciful.machuwe@oakfnd.org', 'Merciful Machuwe', 'admin', 'OAK', true),
    ('cheryl.chang@oakfnd.ch', 'Cheryl Chang', 'admin', 'OAK', true),
    ('silvia.guizzardi@oakfnd.ch', 'Silvia Guizzardi', 'admin', 'OAK', true)
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    team = EXCLUDED.team,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- 5. ENSURE SILVIA GUIZZARDI'S ADVISOR EMAIL IS CORRECT
UPDATE public.advisors
SET email = 'silvia.guizzardi@oakfnd.ch'
WHERE slug = 'silvia-guizzardi' OR lower(full_name) = 'silvia guizzardi';

-- 6. PREVENT ZERO ACTIVE SUPER ADMINS TRIGGER
CREATE OR REPLACE FUNCTION public.check_super_admin_safety()
RETURNS TRIGGER AS $$
DECLARE
    active_super_count INTEGER;
BEGIN
    -- Check if an active super_admin is being demoted, deactivated, or deleted
    IF (TG_OP = 'DELETE' AND OLD.role = 'super_admin' AND OLD.is_active = true) OR
       (TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND OLD.is_active = true AND (NEW.role <> 'super_admin' OR NEW.is_active = false)) THEN
        
        SELECT COUNT(*) INTO active_super_count
        FROM public.admin_users
        WHERE role = 'super_admin' AND is_active = true AND id <> OLD.id;
        
        IF active_super_count < 1 THEN
            RAISE EXCEPTION 'Cannot remove, demote, or deactivate the only active super admin. At least one active super admin is required.';
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_super_admin_safety ON public.admin_users;
CREATE TRIGGER trg_check_super_admin_safety
BEFORE UPDATE OR DELETE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.check_super_admin_safety();
