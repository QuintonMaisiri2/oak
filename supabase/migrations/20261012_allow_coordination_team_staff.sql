-- Allow Coordination Team and OAK Staff members to be recognized as staff/admin
CREATE OR REPLACE FUNCTION public.is_oak_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND (
        lower(u.email) LIKE '%@uncommon.org'
        OR EXISTS (
          SELECT 1 FROM public.attendees a
          WHERE lower(a.email) = lower(u.email)
            AND a.role IN ('Coordination Team', 'OAK Staff')
        )
      )
  );
$$;
