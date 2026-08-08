import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Eye, X, Upload, Trash2, Send, Play } from 'lucide-react';
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
        <span className="text-xs text-muted-foreground">{reels.length} clips</span>
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
              className="relative flex h-full w-full snap-start snap-always items-center justify-center bg-black"
            >
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
                      r.liked ? 'bg-gradient-gold shadow-gold' : 'bg-black/45'
                    }`}
                  >
                    <Heart size={20} className={r.liked ? 'fill-current text-primary-foreground' : 'text-foreground'} />
                  </span>
                  <span className="text-[11px] font-semibold text-foreground">{r.likes}</span>
                </button>
                <button
                  onClick={() => setActiveComments(r.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-black/45">
                    <MessageCircle size={20} className="text-foreground" />
                  </span>
                  <span className="text-[11px] font-semibold text-foreground">{r.comments}</span>
                </button>
                <div className="flex flex-col items-center gap-1">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-black/45">
                    <Eye size={20} className="text-foreground" />
                  </span>
                  <span className="text-[11px] font-semibold text-foreground">{r.views}</span>
                </div>
                {(canManage || r.added_by === meId) && (
                  <button onClick={() => remove(r)} className="grid h-11 w-11 place-items-center rounded-full bg-black/45">
                    <Trash2 size={18} className="text-destructive" />
                  </button>
                )}
              </div>

              {/* Caption */}
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-8 pt-14">
                <div className="flex items-center gap-2">
                  <Avatar name={r.uploaderName} size={34} avatarUrl={r.uploaderAvatar} />
                  <span className="text-sm font-semibold text-foreground">{r.uploaderName}</span>
                </div>
                {r.caption && <p className="mt-2 max-w-[80%] text-sm text-foreground/90">{r.caption}</p>}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeComments && (
        <CommentSheet reelId={activeComments} meId={meId} onClose={() => { setActiveComments(null); reload(); }} />
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
const CommentSheet = ({ reelId, meId, onClose }: { reelId: string; meId: string; onClose: () => void }) => {
  const [items, setItems] = useState<{ id: string; content: string; user_id: string; name: string; avatar: string | null }[]>([]);
  const [text, setText] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('reel_comments')
      .select('id, content, user_id')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: true });
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setItems(rows.map((r) => ({ ...r, name: map.get(r.user_id)?.display_name ?? 'Member', avatar: map.get(r.user_id)?.avatar_url ?? null })));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reelId]);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    await supabase.from('reel_comments').insert({ reel_id: reelId, user_id: meId, content: value });
    load();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[70%] rounded-t-3xl border-t border-border bg-card p-4 shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
        <h3 className="font-display text-base font-semibold">Comments</h3>
        <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
          {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>}
          {items.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.name} size={30} avatarUrl={c.avatar} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{c.name}</p>
                <p className="text-sm text-foreground/85 break-words">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full bg-app-input-bg px-4 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Add a comment…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={send} className="text-primary"><Send size={17} /></button>
        </div>
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
