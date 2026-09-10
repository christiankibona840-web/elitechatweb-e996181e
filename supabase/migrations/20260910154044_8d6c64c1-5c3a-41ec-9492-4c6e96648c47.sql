
GRANT DELETE ON public.messages TO authenticated;
GRANT DELETE ON public.group_messages TO authenticated;

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages"
ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own group messages" ON public.group_messages;
CREATE POLICY "Users can delete their own group messages"
ON public.group_messages FOR DELETE TO authenticated
USING (
  auth.uid() = sender_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_messages.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION public.cleanup_message_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.message_reactions WHERE message_id = OLD.id;
  DELETE FROM public.starred_messages WHERE message_id = OLD.id;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS messages_cleanup_refs ON public.messages;
CREATE TRIGGER messages_cleanup_refs BEFORE DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.cleanup_message_refs();

DROP TRIGGER IF EXISTS group_messages_cleanup_refs ON public.group_messages;
CREATE TRIGGER group_messages_cleanup_refs BEFORE DELETE ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.cleanup_message_refs();
