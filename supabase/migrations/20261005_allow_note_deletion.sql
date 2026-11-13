GRANT DELETE ON public.documentation_posts TO authenticated;

DROP POLICY IF EXISTS "Delete own programme notes" ON public.documentation_posts;
CREATE POLICY "Delete own programme notes" ON public.documentation_posts
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
