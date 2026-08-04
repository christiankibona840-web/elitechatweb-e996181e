
-- ============ REELS UPGRADE ============
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Admins or reel managers can insert reels" ON public.reels;
DROP POLICY IF EXISTS "Admins or reel managers can update reels" ON public.reels;
DROP POLICY IF EXISTS "Admins or reel managers can delete reels" ON public.reels;

CREATE POLICY "Authenticated can post reels" ON public.reels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = added_by);
CREATE POLICY "Owners or managers can update reels" ON public.reels FOR UPDATE TO authenticated
  USING (auth.uid() = added_by OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'reel_manager'))
  WITH CHECK (auth.uid() = added_by OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'reel_manager'));
CREATE POLICY "Owners or managers can delete reels" ON public.reels FOR DELETE TO authenticated
  USING (auth.uid() = added_by OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'reel_manager'));

CREATE TABLE IF NOT EXISTS public.reel_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.reel_likes TO authenticated;
GRANT ALL ON public.reel_likes TO service_role;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View reel likes" ON public.reel_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Like reels" ON public.reel_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Unlike reels" ON public.reel_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.reel_comments TO authenticated;
GRANT ALL ON public.reel_comments TO service_role;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View reel comments" ON public.reel_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add reel comments" ON public.reel_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own reel comments" ON public.reel_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.increment_reel_view(_reel_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.reels SET views = views + 1 WHERE id = _reel_id;
$$;

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_all_on_reel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body)
  SELECT p.id, 'reel', 'New reel posted', COALESCE(NEW.caption, 'Tap Reels to watch')
  FROM public.profiles p WHERE p.id <> NEW.added_by;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reels_notify ON public.reels;
CREATE TRIGGER reels_notify AFTER INSERT ON public.reels
FOR EACH ROW EXECUTE FUNCTION public.notify_all_on_reel();

CREATE OR REPLACE FUNCTION public.notify_all_on_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body)
  SELECT p.id, 'announcement', NEW.title, left(NEW.content, 140)
  FROM public.profiles p WHERE p.id <> NEW.admin_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS announcements_notify ON public.announcements;
CREATE TRIGGER announcements_notify AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_all_on_announcement();

-- ============ AUTO CLEANUP ============
CREATE OR REPLACE FUNCTION public.purge_expired_content()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.statuses WHERE expires_at IS NOT NULL AND expires_at < now();
  DELETE FROM public.game_invites WHERE status = 'pending' AND created_at < now() - interval '1 hour';
  DELETE FROM public.notifications WHERE created_at < now() - interval '14 days';
END $$;
GRANT EXECUTE ON FUNCTION public.purge_expired_content() TO authenticated;
