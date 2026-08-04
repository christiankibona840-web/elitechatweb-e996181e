import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const REELS_BUCKET = 'chat-files';

export interface ReelItem {
  id: string;
  url: string;
  caption: string | null;
  position: number;
  views: number;
  added_by: string;
  created_at: string;
  uploaderName: string;
  uploaderAvatar: string | null;
  likes: number;
  liked: boolean;
  comments: number;
  src: string | null;
}

export function useReels(meId?: string) {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reels')
      .select('id, url, caption, position, views, added_by, created_at')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    const rows = data ?? [];
    if (rows.length === 0) {
      setReels([]);
      setLoading(false);
      return;
    }

    const ids = rows.map((r) => r.id);
    const uploaderIds = Array.from(new Set(rows.map((r) => r.added_by)));

    const [{ data: profiles }, { data: likes }, { data: comments }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').in('id', uploaderIds),
      supabase.from('reel_likes').select('reel_id, user_id').in('reel_id', ids),
      supabase.from('reel_comments').select('reel_id').in('reel_id', ids),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const resolved = await Promise.all(
      rows.map(async (r) => {
        let src: string | null = r.url;
        if (!/^https?:\/\//i.test(r.url)) {
          const { data: signed } = await supabase.storage
            .from(REELS_BUCKET)
            .createSignedUrl(r.url, 60 * 60 * 24 * 7);
          src = signed?.signedUrl ?? null;
        }
        const p = profileMap.get(r.added_by);
        const reelLikes = (likes ?? []).filter((l) => l.reel_id === r.id);
        return {
          ...r,
          src,
          uploaderName: p?.display_name ?? 'Member',
          uploaderAvatar: p?.avatar_url ?? null,
          likes: reelLikes.length,
          liked: !!meId && reelLikes.some((l) => l.user_id === meId),
          comments: (comments ?? []).filter((c) => c.reel_id === r.id).length,
        } as ReelItem;
      })
    );

    setReels(resolved);
    setLoading(false);
  }, [meId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('reels-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_likes' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { reels, loading, reload: load, setReels };
}

export async function toggleReelLike(reelId: string, userId: string, liked: boolean) {
  if (liked) {
    await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', userId);
  } else {
    await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: userId });
  }
}

export async function uploadReel(file: File, userId: string, caption: string, nextPosition: number) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `reels/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(REELS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { error } = await supabase.from('reels').insert({
    url: path,
    added_by: userId,
    caption: caption.trim() || null,
    position: nextPosition,
  });
  if (error) throw error;
}
