
CREATE TABLE public.leader_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leader_name TEXT NOT NULL,
  caption TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_posts TO authenticated;
GRANT ALL ON public.leader_posts TO service_role;

ALTER TABLE public.leader_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed-in can view leader posts"
  ON public.leader_posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert leader posts"
  ON public.leader_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND uploader_id = auth.uid());

CREATE POLICY "Admins or uploader can delete leader posts"
  ON public.leader_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR uploader_id = auth.uid());

CREATE POLICY "Admins can update leader posts"
  ON public.leader_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_leader_posts_created_at ON public.leader_posts (created_at DESC);
