import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Trash2, Pencil, Check, X, MessageSquare } from 'lucide-react';

interface AdminReel {
  id: string;
  url: string;
  caption: string | null;
  views: number;
  created_at: string;
  added_by: string;
  uploader: string;
  src: string | null;
  commentCount: number;
}

interface AdminComment {
  id: string;
  content: string;
  user_id: string;
  edited_at: string | null;
  name: string;
}

const ReelsModerationPanel = () => {
  const [reels, setReels] = useState<AdminReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<AdminComment[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reels')
      .select('id, url, caption, views, created_at, added_by')
      .order('created_at', { ascending: false });
    const rows = data ?? [];
    const ids = rows.map((r) => r.id);
    const uploaderIds = Array.from(new Set(rows.map((r) => r.added_by)));
    const [{ data: profiles }, { data: cmts }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').in('id', uploaderIds),
      ids.length ? supabase.from('reel_comments').select('reel_id').in('reel_id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    const resolved = await Promise.all(
      rows.map(async (r) => {
        let src: string | null = r.url;
        if (!/^https?:\/\//i.test(r.url)) {
          const { data: signed } = await supabase.storage.from('chat-files').createSignedUrl(r.url, 60 * 60 * 24);
          src = signed?.signedUrl ?? null;
        }
        return {
          ...r,
          src,
          uploader: pmap.get(r.added_by) ?? 'Member',
          commentCount: (cmts ?? []).filter((c: any) => c.reel_id === r.id).length,
        } as AdminReel;
      })
    );
    setReels(resolved);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadComments = async (reelId: string) => {
    const { data } = await supabase
      .from('reel_comments')
      .select('id, content, user_id, edited_at')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as any[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, display_name').in('id', ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    setComments(rows.map((r) => ({ ...r, name: map.get(r.user_id) ?? 'Member' })));
    setOpenComments(reelId);
  };

  const saveCaption = async (r: AdminReel) => {
    const { error } = await supabase.from('reels').update({ caption: draft.trim() || null }).eq('id', r.id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    setEditing(null);
    toast({ title: 'Caption updated' });
    load();
  };

  const deleteReel = async (r: AdminReel) => {
    if (!window.confirm('Delete this reel and all its likes/comments?')) return;
    await supabase.from('reel_comments').delete().eq('reel_id', r.id);
    await supabase.from('reel_likes').delete().eq('reel_id', r.id);
    const { error } = await supabase.from('reels').delete().eq('id', r.id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    if (!/^https?:\/\//i.test(r.url)) await supabase.storage.from('chat-files').remove([r.url]);
    toast({ title: 'Reel deleted' });
    setOpenComments(null);
    load();
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('reel_comments').delete().eq('id', id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    setComments((prev) => prev.filter((c) => c.id !== id));
    load();
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading reels…</p>;
  if (reels.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No reels posted yet.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {reels.map((r) => (
        <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-card">
          {r.src ? (
            <video src={r.src} className="aspect-[9/16] w-full bg-black object-cover" controls preload="metadata" />
          ) : (
            <div className="grid aspect-[9/16] w-full place-items-center bg-muted text-xs text-muted-foreground">Unavailable</div>
          )}
          <div className="space-y-2 p-3">
            <p className="text-xs text-muted-foreground">
              by <span className="font-medium text-foreground">{r.uploader}</span> · {r.views} views
            </p>
            {editing === r.id ? (
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1 rounded-lg bg-app-input-bg px-3 py-1.5 text-sm outline-none"
                />
                <button onClick={() => saveCaption(r)} className="text-primary" aria-label="Save caption"><Check size={16} /></button>
                <button onClick={() => setEditing(null)} className="text-muted-foreground" aria-label="Cancel"><X size={16} /></button>
              </div>
            ) : (
              <p className="text-sm text-foreground/90">{r.caption || <span className="italic text-muted-foreground">No caption</span>}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => { setEditing(r.id); setDraft(r.caption ?? ''); }}
                className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium hover:bg-muted/70"
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                onClick={() => loadComments(r.id)}
                className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium hover:bg-muted/70"
              >
                <MessageSquare size={13} /> {r.commentCount}
              </button>
              <button
                onClick={() => deleteReel(r)}
                className="ml-auto flex items-center gap-1 rounded-lg bg-destructive/15 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>

            {openComments === r.id && (
              <div className="mt-2 space-y-2 border-t border-border pt-2">
                {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{c.name}</span>
                      {c.edited_at && <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>}
                      <p className="break-words text-foreground/80">{c.content}</p>
                    </div>
                    <button onClick={() => deleteComment(c.id)} className="text-destructive" aria-label="Delete comment">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReelsModerationPanel;
