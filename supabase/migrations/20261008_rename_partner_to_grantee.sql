DO $$ 
DECLARE
  con record;
BEGIN
  FOR con IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.attendees'::regclass AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE public.attendees DROP CONSTRAINT ' || quote_ident(con.conname);
  END LOOP;
END $$;

ALTER TABLE public.attendees ADD CONSTRAINT attendees_role_check CHECK (role IN ('Grantee', 'Partner', 'OAK Staff', 'Coordination Team', 'Presenter', 'Observer'));

UPDATE public.attendees SET role = 'Grantee' WHERE role = 'Partner';