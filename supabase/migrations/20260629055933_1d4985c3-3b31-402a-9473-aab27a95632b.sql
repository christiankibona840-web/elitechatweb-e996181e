CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_x UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_o UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board TEXT[] NOT NULL DEFAULT ARRAY['','','','','','','','',''],
  current_turn TEXT NOT NULL DEFAULT 'X',
  status TEXT NOT NULL DEFAULT 'active',
  winner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TTT players see their games" ON public.games FOR SELECT TO authenticated USING (auth.uid() = player_x OR auth.uid() = player_o);
CREATE POLICY "TTT players create games" ON public.games FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_x OR auth.uid() = player_o);
CREATE POLICY "TTT players update their games" ON public.games FOR UPDATE TO authenticated USING (auth.uid() = player_x OR auth.uid() = player_o);

CREATE TABLE public.game_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  game_id UUID,
  game_type TEXT NOT NULL DEFAULT 'ttt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_invites TO authenticated;
GRANT ALL ON public.game_invites TO service_role;
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invite participants see invites" ON public.game_invites FOR SELECT TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "Users send invites" ON public.game_invites FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);
CREATE POLICY "Participants update invites" ON public.game_invites FOR UPDATE TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "Participants delete invites" ON public.game_invites FOR DELETE TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;

CREATE SEQUENCE public.user_number_seq START 1;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_number INT NOT NULL DEFAULT nextval('public.user_number_seq') UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  readable_id TEXT GENERATED ALWAYS AS (lpad(user_number::text, 4, '0') || username) STORED UNIQUE,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  gender text DEFAULT null,
  chat_theme jsonb DEFAULT null,
  bubble_radius text DEFAULT 'lg',
  member_id TEXT UNIQUE,
  disabled BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own contacts" ON public.contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own contacts" ON public.contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  reply_to jsonb DEFAULT NULL,
  deleted_for_everyone boolean DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Senders can edit own messages" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id) WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE INDEX idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id, created_at);

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ownerless BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE user_id = _user_id AND group_id = _group_id);
$$;

CREATE POLICY "Members see groups" ON public.groups FOR SELECT TO authenticated USING (public.is_group_member(auth.uid(), id));
CREATE POLICY "Anyone can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members see group members" ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Group admins add members" ON public.group_members FOR INSERT TO authenticated WITH CHECK (
  is_group_member(auth.uid(), group_id) OR EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
);
CREATE POLICY "Admins or self can remove" ON public.group_members FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR (SELECT role FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()) = 'admin'
);
CREATE POLICY "Admins can update member roles" ON public.group_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
);

CREATE TABLE public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  reply_to jsonb DEFAULT NULL,
  deleted_for_everyone boolean DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see group messages" ON public.group_messages FOR SELECT TO authenticated USING (public.is_group_member(auth.uid(), group_id));
CREATE POLICY "Members send group messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (public.is_group_member(auth.uid(), group_id) AND auth.uid() = sender_id);
CREATE POLICY "Senders can edit own group messages" ON public.group_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Senders can delete own group messages" ON public.group_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);
CREATE INDEX idx_group_messages ON public.group_messages(group_id, created_at);

CREATE TABLE public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.statuses TO authenticated;
GRANT ALL ON public.statuses TO service_role;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated see statuses" ON public.statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users post own statuses" ON public.statuses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own statuses" ON public.statuses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.status_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(status_id, viewer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_views TO authenticated;
GRANT ALL ON public.status_views TO service_role;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Status owner sees views" ON public.status_views FOR SELECT TO authenticated USING ((SELECT user_id FROM public.statuses WHERE id = status_id) = auth.uid());
CREATE POLICY "Users mark viewed" ON public.status_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- Storage RLS for chat-files bucket
CREATE POLICY "Authenticated upload chat files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-files');
CREATE POLICY "Authenticated view chat files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-files');
CREATE POLICY "Authenticated update chat files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'chat-files');
CREATE POLICY "Authenticated delete chat files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-files');

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'dm',
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated see reactions" ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users add reactions" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove reactions" ON public.message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  media_url text,
  media_type text,
  file_name text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view comments" ON public.project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own comments" ON public.project_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.project_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_comments;

CREATE TABLE public.starred_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  message_type text NOT NULL DEFAULT 'dm',
  chat_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.starred_messages TO authenticated;
GRANT ALL ON public.starred_messages TO service_role;
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own stars" ON public.starred_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own stars" ON public.starred_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own stars" ON public.starred_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.disappearing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  chat_type text NOT NULL DEFAULT 'dm',
  duration_seconds integer NOT NULL DEFAULT 86400,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, chat_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disappearing_settings TO authenticated;
GRANT ALL ON public.disappearing_settings TO service_role;
ALTER TABLE public.disappearing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own settings" ON public.disappearing_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own settings" ON public.disappearing_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.disappearing_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own settings" ON public.disappearing_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'reel_manager');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.assign_admin_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.email IN ('kibona@gmail.com', 'respect.chf@gmail.com', 'bcmetrynx@gmail.com', 'jsonsmarty@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.email = 'dercdemot@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'reel_manager') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created_assign_admin
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_admin_on_signup();

CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see all blocks" ON public.blocked_users FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can block users" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can unblock users" ON public.blocked_users FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users see own blocks" ON public.blocked_users FOR SELECT TO authenticated USING (blocked_id = auth.uid());

CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  admin_id UUID NOT NULL,
  admin_name TEXT NOT NULL DEFAULT '',
  admin_avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update announcements" ON public.announcements FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete announcements" ON public.announcements FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.auto_join_default_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_default_group_id UUID;
BEGIN
  SELECT id INTO v_default_group_id FROM public.groups WHERE name = 'Yst Tbss & Tgss' LIMIT 1;
  IF v_default_group_id IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_default_group_id, NEW.id, 'member') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER auto_join_default_group_trigger
AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_join_default_group();

CREATE OR REPLACE FUNCTION public.is_default_group(_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group_id AND name = 'Yst Tbss & Tgss');
$$;

CREATE OR REPLACE FUNCTION public.prevent_leave_default_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_default_group(OLD.group_id) THEN
    RAISE EXCEPTION 'Cannot leave the default community group';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER prevent_leave_default_group_trigger
BEFORE DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.prevent_leave_default_group();

CREATE TABLE public.reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  added_by UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reels TO authenticated;
GRANT ALL ON public.reels TO service_role;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can view reels" ON public.reels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins or reel managers can insert reels" ON public.reels FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'reel_manager'::public.app_role));
CREATE POLICY "Admins or reel managers can update reels" ON public.reels FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'reel_manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'reel_manager'::public.app_role));
CREATE POLICY "Admins or reel managers can delete reels" ON public.reels FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'reel_manager'::public.app_role));

ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_invites REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;

CREATE TABLE public.c4_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_red UUID NOT NULL,
  player_yellow UUID NOT NULL,
  board TEXT[] NOT NULL DEFAULT ARRAY['','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','',''],
  current_turn TEXT NOT NULL DEFAULT 'R',
  status TEXT NOT NULL DEFAULT 'active',
  winner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.c4_games TO authenticated;
GRANT ALL ON public.c4_games TO service_role;
ALTER TABLE public.c4_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "C4 players see their games" ON public.c4_games FOR SELECT TO authenticated USING (auth.uid() = player_red OR auth.uid() = player_yellow);
CREATE POLICY "C4 players create games" ON public.c4_games FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_red OR auth.uid() = player_yellow);
CREATE POLICY "C4 players update their games" ON public.c4_games FOR UPDATE TO authenticated USING (auth.uid() = player_red OR auth.uid() = player_yellow);
ALTER PUBLICATION supabase_realtime ADD TABLE public.c4_games;

CREATE TABLE public.used_usernames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.used_usernames TO authenticated;
GRANT ALL ON public.used_usernames TO service_role;
ALTER TABLE public.used_usernames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage used usernames" ON public.used_usernames FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read used usernames" ON public.used_usernames FOR SELECT TO authenticated USING (true);
CREATE UNIQUE INDEX profiles_username_unique_idx ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.log_username_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    INSERT INTO public.used_usernames (username, assigned_by)
    VALUES (lower(NEW.username), auth.uid()) ON CONFLICT (username) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_log_username_assignment
AFTER INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_username_assignment();

CREATE OR REPLACE FUNCTION public.admin_assign_username(_target_user_id UUID, _new_username TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clean TEXT; v_current TEXT;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_clean := lower(trim(_new_username));
  IF v_clean !~ '^[a-z0-9_]{3,20}$' THEN RAISE EXCEPTION 'Invalid format: 3-20 chars, lowercase letters/numbers/underscore only'; END IF;
  IF v_clean LIKE '\_%' ESCAPE '\' OR v_clean LIKE '%\_' ESCAPE '\' THEN RAISE EXCEPTION 'Cannot start or end with underscore'; END IF;
  IF v_clean LIKE '%__%' THEN RAISE EXCEPTION 'Cannot contain consecutive underscores'; END IF;
  SELECT lower(username) INTO v_current FROM public.profiles WHERE id = _target_user_id;
  IF v_current = v_clean THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.used_usernames WHERE username = v_clean) THEN RAISE EXCEPTION 'This ID is permanently reserved and cannot be reused'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean AND id <> _target_user_id) THEN RAISE EXCEPTION 'This ID is already taken'; END IF;
  UPDATE public.profiles SET username = v_clean WHERE id = _target_user_id;
END;
$$;

CREATE TYPE public.approved_id_status AS ENUM ('available', 'claimed', 'disabled');

CREATE TABLE public.approved_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL UNIQUE,
  status public.approved_id_status NOT NULL DEFAULT 'available',
  claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_id_format CHECK (member_id ~ '^#\d{3}-\d{3}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_ids TO authenticated;
GRANT SELECT ON public.approved_ids TO anon;
GRANT ALL ON public.approved_ids TO service_role;
CREATE INDEX approved_ids_status_idx ON public.approved_ids(status);
CREATE INDEX approved_ids_claimed_by_idx ON public.approved_ids(claimed_by_user_id);
ALTER TABLE public.approved_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can check approved IDs" ON public.approved_ids FOR SELECT USING (true);
CREATE POLICY "Admins manage approved IDs - insert" ON public.approved_ids FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage approved IDs - update" ON public.approved_ids FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage approved IDs - delete" ON public.approved_ids FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER approved_ids_updated_at BEFORE UPDATE ON public.approved_ids FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  target_id_code TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
CREATE INDEX admin_audit_log_performed_at_idx ON public.admin_audit_log(performed_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.check_member_id(_member_id TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
  IF _member_id !~ '^#\d{3}-\d{3}$' THEN RETURN 'invalid_format'; END IF;
  SELECT status::TEXT INTO v_status FROM public.approved_ids WHERE member_id = _member_id;
  IF v_status IS NULL THEN RETURN 'not_found'; END IF;
  RETURN v_status;
END; $$;
GRANT EXECUTE ON FUNCTION public.check_member_id(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_member_id TEXT; v_status public.approved_id_status;
BEGIN
  v_member_id := NEW.raw_user_meta_data->>'member_id';
  IF v_member_id IS NOT NULL AND v_member_id <> '' THEN
    SELECT status INTO v_status FROM public.approved_ids WHERE member_id = v_member_id FOR UPDATE;
    IF v_status IS NULL THEN RAISE EXCEPTION 'This ID is not recognized. Please contact your administrator.'; END IF;
    IF v_status = 'claimed' THEN RAISE EXCEPTION 'This ID is already in use. Please contact your administrator.'; END IF;
    IF v_status = 'disabled' THEN RAISE EXCEPTION 'This ID has been disabled. Please contact your administrator.'; END IF;
    UPDATE public.approved_ids SET status = 'claimed', claimed_by_user_id = NEW.id, claimed_at = now() WHERE member_id = v_member_id;
  END IF;
  INSERT INTO public.profiles (id, username, display_name, member_id)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_member_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_force_delete_user(_target_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_member_id TEXT; g RECORD; v_next_owner UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOR g IN SELECT id FROM public.groups WHERE created_by = _target_user_id LOOP
    SELECT user_id INTO v_next_owner FROM public.group_members
      WHERE group_id = g.id AND user_id <> _target_user_id ORDER BY joined_at ASC LIMIT 1;
    IF v_next_owner IS NOT NULL THEN
      UPDATE public.groups SET created_by = v_next_owner WHERE id = g.id;
      UPDATE public.group_members SET role = 'admin' WHERE group_id = g.id AND user_id = v_next_owner;
    ELSE
      UPDATE public.groups SET ownerless = true WHERE id = g.id;
    END IF;
  END LOOP;
  ALTER TABLE public.group_members DISABLE TRIGGER USER;
  DELETE FROM public.group_members WHERE user_id = _target_user_id;
  ALTER TABLE public.group_members ENABLE TRIGGER USER;
  DELETE FROM public.message_reactions WHERE user_id = _target_user_id;
  DELETE FROM public.starred_messages WHERE user_id = _target_user_id;
  DELETE FROM public.status_views WHERE viewer_id = _target_user_id;
  DELETE FROM public.statuses WHERE user_id = _target_user_id;
  DELETE FROM public.project_comments WHERE user_id = _target_user_id;
  DELETE FROM public.projects WHERE user_id = _target_user_id;
  DELETE FROM public.contacts WHERE user_id = _target_user_id OR contact_id = _target_user_id;
  DELETE FROM public.blocked_users WHERE blocker_id = _target_user_id OR blocked_id = _target_user_id;
  DELETE FROM public.disappearing_settings WHERE user_id = _target_user_id;
  DELETE FROM public.messages WHERE sender_id = _target_user_id OR receiver_id = _target_user_id;
  DELETE FROM public.group_messages WHERE sender_id = _target_user_id;
  DELETE FROM public.game_invites WHERE from_user = _target_user_id OR to_user = _target_user_id;
  DELETE FROM public.games WHERE player_x = _target_user_id OR player_o = _target_user_id;
  DELETE FROM public.c4_games WHERE player_red = _target_user_id OR player_yellow = _target_user_id;
  DELETE FROM public.announcements WHERE admin_id = _target_user_id;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  SELECT member_id INTO v_member_id FROM public.profiles WHERE id = _target_user_id;
  IF v_member_id IS NOT NULL THEN
    UPDATE public.approved_ids SET status = 'disabled', claimed_by_user_id = NULL WHERE member_id = v_member_id;
  END IF;
  DELETE FROM public.profiles WHERE id = _target_user_id;
  DELETE FROM auth.users WHERE id = _target_user_id;
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_user_id, target_id_code, details)
  VALUES (auth.uid(), 'force_delete_user', _target_user_id, v_member_id, jsonb_build_object('member_id', v_member_id));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_target_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.admin_force_delete_user(_target_user_id); END; $$;

CREATE OR REPLACE FUNCTION public.admin_remove_from_group(_target_user_id UUID, _group_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_creator UUID; v_next_owner UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT created_by INTO v_creator FROM public.groups WHERE id = _group_id;
  IF v_creator = _target_user_id THEN
    SELECT user_id INTO v_next_owner FROM public.group_members
      WHERE group_id = _group_id AND user_id <> _target_user_id ORDER BY joined_at ASC LIMIT 1;
    IF v_next_owner IS NOT NULL THEN
      UPDATE public.groups SET created_by = v_next_owner WHERE id = _group_id;
      UPDATE public.group_members SET role = 'admin' WHERE group_id = _group_id AND user_id = v_next_owner;
    ELSE
      UPDATE public.groups SET ownerless = true WHERE id = _group_id;
    END IF;
  END IF;
  ALTER TABLE public.group_members DISABLE TRIGGER USER;
  DELETE FROM public.group_members WHERE group_id = _group_id AND user_id = _target_user_id;
  ALTER TABLE public.group_members ENABLE TRIGGER USER;
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_user_id, details)
  VALUES (auth.uid(), 'remove_from_group', _target_user_id, jsonb_build_object('group_id', _group_id));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_user_groups(_target_user_id UUID)
RETURNS TABLE(group_id UUID, name TEXT, member_count BIGINT, role TEXT, is_owner BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT g.id, g.name,
    (SELECT COUNT(*) FROM public.group_members gm2 WHERE gm2.group_id = g.id),
    gm.role, (g.created_by = _target_user_id)
  FROM public.groups g JOIN public.group_members gm ON gm.group_id = g.id
  WHERE gm.user_id = _target_user_id ORDER BY g.name;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_all_groups()
RETURNS TABLE(id UUID, name TEXT, description TEXT, avatar_url TEXT, created_at TIMESTAMPTZ, created_by UUID, owner_username TEXT, member_count BIGINT, ownerless BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.description, g.avatar_url, g.created_at, g.created_by,
    p.username, (SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id), g.ownerless
  FROM public.groups g LEFT JOIN public.profiles p ON p.id = g.created_by
  ORDER BY g.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_group_members(_group_id UUID)
RETURNS TABLE(user_id UUID, username TEXT, display_name TEXT, avatar_url TEXT, role TEXT, joined_at TIMESTAMPTZ, is_owner BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_creator UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT created_by INTO v_creator FROM public.groups WHERE id = _group_id;
  RETURN QUERY
  SELECT gm.user_id, p.username, p.display_name, p.avatar_url, gm.role, gm.joined_at, (gm.user_id = v_creator)
  FROM public.group_members gm JOIN public.profiles p ON p.id = gm.user_id
  WHERE gm.group_id = _group_id ORDER BY gm.joined_at ASC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id UUID, email TEXT, display_name TEXT, username TEXT, avatar_url TEXT, created_at TIMESTAMPTZ, is_online BOOLEAN, last_seen TIMESTAMPTZ, member_id TEXT, disabled BOOLEAN, community_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT p.id, u.email::TEXT, p.display_name, p.username, p.avatar_url, p.created_at, p.is_online, p.last_seen,
    p.member_id, p.disabled,
    (SELECT COUNT(*) FROM public.group_members gm WHERE gm.user_id = p.id)
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_add_approved_ids(_member_ids TEXT[])
RETURNS TABLE(member_id TEXT, success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id TEXT; v_clean TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOREACH v_id IN ARRAY _member_ids LOOP
    v_clean := upper(trim(v_id));
    IF v_clean !~ '^#\d{3}-\d{3}$' THEN
      member_id := v_clean; success := false; message := 'Invalid format'; RETURN NEXT;
      CONTINUE;
    END IF;
    BEGIN
      INSERT INTO public.approved_ids (member_id, created_by) VALUES (v_clean, auth.uid());
      member_id := v_clean; success := true; message := 'Added'; RETURN NEXT;
    EXCEPTION WHEN unique_violation THEN
      member_id := v_clean; success := false; message := 'Already exists'; RETURN NEXT;
    END;
  END LOOP;
  INSERT INTO public.admin_audit_log (admin_user_id, action, details)
  VALUES (auth.uid(), 'add_approved_ids', jsonb_build_object('count', array_length(_member_ids, 1)));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_generate_approved_ids(_prefix TEXT, _start INT, _count INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i INT; v_id TEXT; v_added INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _prefix !~ '^#\d{3}-$' THEN RAISE EXCEPTION 'Invalid prefix. Use format #180- or #360-'; END IF;
  IF _count < 1 OR _count > 1000 THEN RAISE EXCEPTION 'Count must be 1-1000'; END IF;
  FOR i IN _start.._start + _count - 1 LOOP
    v_id := _prefix || lpad(i::TEXT, 3, '0');
    BEGIN
      INSERT INTO public.approved_ids (member_id, created_by) VALUES (v_id, auth.uid());
      v_added := v_added + 1;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;
  INSERT INTO public.admin_audit_log (admin_user_id, action, details)
  VALUES (auth.uid(), 'generate_approved_ids', jsonb_build_object('prefix', _prefix, 'start', _start, 'count', _count, 'added', v_added));
  RETURN v_added;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_approved_id_status(_member_id TEXT, _status public.approved_id_status)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.approved_ids SET status = _status WHERE member_id = _member_id
  RETURNING claimed_by_user_id INTO v_user;
  IF _status = 'disabled' AND v_user IS NOT NULL THEN
    UPDATE public.profiles SET disabled = true WHERE id = v_user;
  END IF;
  IF _status = 'available' AND v_user IS NOT NULL THEN
    UPDATE public.profiles SET disabled = false WHERE id = v_user;
  END IF;
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_id_code, details)
  VALUES (auth.uid(), 'set_approved_id_status', _member_id, jsonb_build_object('status', _status));
END; $$;

CREATE TABLE public.status_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(status_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_likes TO authenticated;
GRANT ALL ON public.status_likes TO service_role;
ALTER TABLE public.status_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated views likes" ON public.status_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like" ON public.status_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike" ON public.status_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.status_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_comments TO authenticated;
GRANT ALL ON public.status_comments TO service_role;
ALTER TABLE public.status_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or commenter can view" ON public.status_comments FOR SELECT TO authenticated
USING (auth.uid() = user_id OR auth.uid() = (SELECT user_id FROM public.statuses WHERE id = status_id));
CREATE POLICY "Authenticated can comment" ON public.status_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Commenter can delete" ON public.status_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_status_likes_status ON public.status_likes(status_id);
CREATE INDEX idx_status_comments_status ON public.status_comments(status_id);
CREATE INDEX idx_status_views_status ON public.status_views(status_id);

GRANT USAGE, SELECT ON SEQUENCE public.user_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_number_seq TO service_role;
