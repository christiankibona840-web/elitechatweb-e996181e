import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Eye, X, Upload, Trash2, Send, Play, Pencil, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import Avatar from '@/components/Avatar';
import { useReels, toggleReelLike, uploadReel, type ReelItem } from './useReels';

interface Props {
  meId: string;
  canManage?: boolean;
  onClose: () => void;
}

const ReelsFeed = ({ meId, canManage, onClose }: Props) => {
  const { reels, loading, reload } = useReels(meId);
  const [activeComments, setActiveComments] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewed = useRef<Set<string>>(new Set());

  // Auto play / pause + auto view counting
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll('video')) as HTMLVideoElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          const id = v.dataset['reelId'];
          if (e.intersectionRatio > 0.65) {
            v.play().catch(() => {});
            if (id && !viewed.current.has(id)) {
              viewed.current.add(id);
              supabase.rpc('increment_reel_view', { _reel_id: id });
            }
          } else {
            v.pause();
          }
        });
      },
      { root, threshold: [0, 0.65, 1] }
    );
    videos.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [reels]);

  const like = async (r: ReelItem) => {
    await toggleReelLike(r.id, meId, r.liked);
    reload();
  };

  const remove = async (r: ReelItem) => {
    if (!window.confirm('Delete this reel permanently? Its likes and comments will be removed too.')) return;
    setDeleting(r.id);
    try {
      await supabase.from('reel_comments').delete().eq('reel_id', r.id);
      await supabase.from('reel_likes').delete().eq('reel_id', r.id);
      const { error } = await supabase.from('reels').delete().eq('id', r.id);
      if (error) throw error;
      if (!/^https?:\/\//i.test(r.url)) await supabase.storage.from('chat-files').remove([r.url]);
      toast({ title: 'Reel deleted' });
      reload();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-background/95 to-transparent">
        <h2 className="font-display text-lg font-bold text-gradient-gold">Reels</h2>
        <span className="text-xs font-medium text-foreground/80 text-legible">{reels.length} clips</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-gold px-4 py-2 text-xs font-semibold text-primary-foreground shadow-gold"
          >
            <Upload size={14} /> Post
          </button>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted/60 text-foreground"
            aria-label="Close reels"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading reels…</div>
      ) : reels.length === 0 ? (
        <div className="grid h-full place-items-center px-8 text-center">
          <div>
            <Play size={40} className="mx-auto mb-3 text-primary" />
            <p className="font-display text-lg font-semibold">No reels yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to post one.</p>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full overflow-y-auto no-scrollbar"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {reels.map((r) => (
            <section
              key={r.id}
              className="relative flex h-full w-full snap-start snap-always bg-black lg:gap-0"
            >
              {/* Video stage */}
              <div className="relative flex min-w-0 flex-1 items-center justify-center">
                {r.src ? (
                  <video
                    data-reel-id={r.id}
                    src={r.src}
                    className="h-full w-full object-contain"
                    loop
                    playsInline
                    preload="metadata"
                    onClick={(e) => {
                      const v = e.currentTarget;
                      v.paused ? v.play() : v.pause();
                    }}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">Loading…</div>
                )}

                {/* Right rail actions */}
                <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-5">
                  <button onClick={() => like(r)} className="flex flex-col items-center gap-1">
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-90 ${
                        r.liked ? 'bg-gradient-gold shadow-gold' : 'chip-legible'
                      }`}
                    >
                      <Heart size={20} className={r.liked ? 'fill-current text-primary-foreground' : 'text-foreground'} />
                    </span>
                    <span className="text-[11px] font-bold text-foreground text-legible">{r.likes}</span>
                  </button>
                  <button
                    onClick={() => setActiveComments(r.id)}
                    className="flex flex-col items-center gap-1 lg:hidden"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full chip-legible">
                      <MessageCircle size={20} className="text-foreground" />
                    </span>
                    <span className="text-[11px] font-bold text-foreground text-legible">{r.comments}</span>
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <span className="grid h-11 w-11 place-items-center rounded-full chip-legible">
                      <Eye size={20} className="text-foreground" />
                    </span>
                    <span className="text-[11px] font-bold text-foreground text-legible">{r.views}</span>
                  </div>
                  {(canManage || r.added_by === meId) && (
                    <button
                      onClick={() => remove(r)}
                      disabled={deleting === r.id}
                      aria-label="Delete reel"
                      className="grid h-11 w-11 place-items-center rounded-full chip-legible disabled:opacity-50"
                    >
                      <Trash2 size={18} className="text-destructive" />
                    </button>
                  )}
                </div>

                {/* Caption overlay (mobile / tablet only) */}
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-8 pt-16 lg:hidden">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.uploaderName} size={34} avatarUrl={r.uploaderAvatar} />
                    <span className="text-sm font-bold text-foreground text-legible">{r.uploaderName}</span>
                  </div>
                  {r.caption && <p className="mt-2 max-w-[80%] text-sm font-medium text-foreground text-legible">{r.caption}</p>}
                </div>
              </div>

              {/* Caption + comments side panel (desktop) */}
              <aside className="hidden w-[360px] flex-shrink-0 flex-col border-l border-border bg-card pt-16 lg:flex">
                <div className="border-b border-border px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.uploaderName} size={36} avatarUrl={r.uploaderAvatar} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{r.uploaderName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.views} views · {r.likes} likes
                      </p>
                    </div>
                  </div>
                  {r.caption && <p className="mt-2 text-sm text-foreground/90">{r.caption}</p>}
                </div>
                <CommentsPanel reelId={r.id} meId={meId} canManage={!!canManage} onChanged={reload} />
              </aside>
            </section>
          ))}
        </div>
      )}

      {activeComments && (
        <div
          className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60 lg:hidden"
          onClick={() => { setActiveComments(null); reload(); }}
        >
          <div
            className="flex max-h-[75%] flex-col rounded-t-3xl border-t border-border bg-card p-4 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
            <h3 className="font-display text-base font-semibold">Comments</h3>
            <CommentsPanel reelId={activeComments} meId={meId} canManage={!!canManage} onChanged={reload} />
          </div>
        </div>
      )}
      {showUpload && (
        <UploadSheet
          meId={meId}
          nextPosition={reels.length ? Math.max(...reels.map((r) => r.position)) + 1 : 1}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); reload(); }}
        />
      )}
    </div>
  );
};

/* ---------------- Comments ---------------- */
interface CommentRow {
  id: string;
  content: string;
  user_id: string;
  edited_at: string | null;
  name: string;
  avatar: string | null;
}

const CommentsPanel = ({
  reelId,
  meId,
  canManage,
  onChanged,
}: { reelId: string; meId: string; canManage: boolean; onChanged: () => void }) => {
  const [items, setItems] = useState<CommentRow[]>([]);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('reel_comments')
      .select('id, content, user_id, edited_at')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: true });
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setItems(
      rows.map((r: any) => ({
        ...r,
        name: map.get(r.user_id)?.display_name ?? 'Member',
        avatar: map.get(r.user_id)?.avatar_url ?? null,
      }))
    );
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reelId]);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    await supabase.from('reel_comments').insert({ reel_id: reelId, user_id: meId, content: value });
    await load();
    onChanged();
  };

  const saveEdit = async (id: string) => {
    const value = draft.trim();
    if (!value) return;
    const { error } = await supabase
      .from('reel_comments')
      .update({ content: value, edited_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    setEditingId(null);
    load();
  };

  const removeComment = async (id: string) => {
    if (!window.confirm('Delete this comment?')) return;
    const { error } = await supabase.from('reel_comments').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
    onChanged();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>}
        {items.map((c) => {
          const mine = c.user_id === meId;
          return (
            <div key={c.id} className="group flex gap-2">
              <Avatar name={c.name} size={30} avatarUrl={c.avatar} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">
                  {c.name}
                  {c.edited_at && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(edited)</span>}
                </p>
                {editingId === c.id ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(c.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 rounded-lg bg-app-input-bg px-3 py-1.5 text-sm outline-none"
                    />
                    <button onClick={() => saveEdit(c.id)} className="text-primary" aria-label="Save comment">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground" aria-label="Cancel edit">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <p className="break-words text-sm text-foreground/85">{c.content}</p>
                )}
              </div>
              {editingId !== c.id && (mine || canManage) && (
                <div className="flex flex-shrink-0 items-start gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                  {mine && (
                    <button
                      onClick={() => { setEditingId(c.id); setDraft(c.content); }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Edit comment"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => removeComment(c.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete comment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="m-3 flex items-center gap-2 rounded-full bg-app-input-bg px-4 py-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Add a comment…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button onClick={send} className="text-primary" aria-label="Send comment"><Send size={17} /></button>
      </div>
    </div>
  );
};

/* ---------------- Upload ---------------- */
const UploadSheet = ({
  meId,
  nextPosition,
  onClose,
  onDone,
}: { meId: string; nextPosition: number; onClose: () => void; onDone: () => void }) => {
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Invalid file', description: 'Please choose a video.', variant: 'destructive' });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 100MB.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await uploadReel(file, meId, caption, nextPosition);
      toast({ title: 'Reel posted ✨' });
      onDone();
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold">Post a reel</h3>
        <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/50 px-4 py-7 hover:border-primary transition-colors">
          <Upload size={26} className="text-muted-foreground" />
          <span className="text-sm font-medium">{file ? file.name : 'Choose a video'}</span>
          <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption…"
          className="mt-3 w-full rounded-2xl bg-app-input-bg px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={submit}
          disabled={!file || busy}
          className="mt-4 w-full rounded-2xl bg-gradient-gold py-2.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Post reel'}
        </button>
      </div>
    </div>
  );
};

export default ReelsFeed;
