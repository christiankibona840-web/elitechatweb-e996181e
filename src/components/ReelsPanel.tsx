import { useEffect, useRef, useState } from 'react';
import { Film, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Reel {
  id: string;
  url: string;
  position: number;
}

const BUCKET = 'chat-files';

const ReelsPanel = () => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<boolean>(() => localStorage.getItem('reels-panel-hidden') === '1');
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('reels')
      .select('id, url, position')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    const list = (data as Reel[]) || [];
    setReels(list);
    const map: Record<string, string> = {};
    await Promise.all(
      list.map(async (r) => {
        if (/^https?:\/\//i.test(r.url)) {
          map[r.id] = r.url;
        } else {
          const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(r.url, 60 * 60 * 24 * 7);
          if (s?.signedUrl) map[r.id] = s.signedUrl;
        }
      })
    );
    setSigned(map);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('reels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, () => load())
      .subscribe();
    const handler = () => setHidden(localStorage.getItem('reels-panel-hidden') === '1');
    window.addEventListener('reels-panel-toggle', handler);
    window.addEventListener('storage', handler);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('reels-panel-toggle', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Auto-play the most-visible reel
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll('video')) as HTMLVideoElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.intersectionRatio > 0.6) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { root, threshold: [0, 0.6, 1] }
    );
    videos.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [signed, reels]);

  if (hidden) return null;

  const hide = () => {
    localStorage.setItem('reels-panel-hidden', '1');
    setHidden(true);
    window.dispatchEvent(new Event('reels-panel-toggle'));
  };

  return (
    <aside className="hidden xl:flex flex-col w-[360px] flex-shrink-0 border-l border-border bg-app-header h-screen">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-app-header z-10">
        <Film size={18} className="text-pink-500" />
        <h2 className="font-display text-sm font-semibold text-foreground">Latest Reels</h2>
        <button
          onClick={hide}
          className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          title="Hide reels panel"
          aria-label="Hide reels panel"
        >
          <X size={16} />
        </button>
      </div>

      {reels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-xs text-muted-foreground text-center">No reels yet.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {reels.map((r) => (
            <div
              key={r.id}
              className="snap-start snap-always w-full flex items-center justify-center bg-black"
              style={{ height: 'calc(100vh - 53px)' }}
            >
              {signed[r.id] ? (
                <video
                  src={signed[r.id]}
                  className="w-full h-full object-contain"
                  controls
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="text-xs text-white/60">Loading…</div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default ReelsPanel;
