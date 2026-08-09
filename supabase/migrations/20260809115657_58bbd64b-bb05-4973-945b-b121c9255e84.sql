ALTER TABLE public.reel_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;

DROP POLICY IF EXISTS "Users can edit own reel comments" ON public.reel_comments;
CREATE POLICY "Users can edit own reel comments"
ON public.reel_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete any reel comment" ON public.reel_comments;
CREATE POLICY "Admins can delete any reel comment"
ON public.reel_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete any reel" ON public.reels;
CREATE POLICY "Admins can delete any reel"
ON public.reels FOR DELETE TO authenticated
USING (added_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reel_manager'));

DROP POLICY IF EXISTS "Admins can update any reel" ON public.reels;
CREATE POLICY "Admins can update any reel"
ON public.reels FOR UPDATE TO authenticated
USING (added_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reel_manager'))
WITH CHECK (true);