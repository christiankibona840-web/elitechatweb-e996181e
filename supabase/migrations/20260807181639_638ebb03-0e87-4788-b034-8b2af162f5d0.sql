-- Storage policies for chat-images and chat-videos
CREATE POLICY "Members can view chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('chat-images','chat-videos'));

CREATE POLICY "Members can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('chat-images','chat-videos') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Members can update own chat media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('chat-images','chat-videos') AND owner = auth.uid())
WITH CHECK (bucket_id IN ('chat-images','chat-videos') AND owner = auth.uid());

CREATE POLICY "Members can delete own chat media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('chat-images','chat-videos') AND owner = auth.uid());

-- Fix mutable search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Signed-out visitors should not be able to call internal functions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
