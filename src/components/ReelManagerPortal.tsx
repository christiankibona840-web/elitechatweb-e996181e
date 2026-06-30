import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Film, Trash2, ArrowLeft, LogOut, Upload } from 'lucide-react';

interface Reel {
  id: string;
  url: string; // storage path inside chat-files bucket, or legacy http url
  position: number;
  created_at: string;
}

interface Props {
  onLogout: () => void;
  onBackToChoice?: () => void;
}

const BUCKET = 'chat-files';

const ReelManagerPortal = ({ onLogout, onBackToChoice }: Props) => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('reels')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    const list = (data as Reel[]) || [];
    setReels(list);
    // Generate signed URLs for storage paths (skip legacy http URLs)
    const map: Record<string, string> = {};
    await Promise.all(
      list.map(async (r) => {
        if (/^https?:\/\//i.test(r.url)) {
          map[r.id] = r.url;
        } else {
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(r.url, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) map[r.id] = signed.signedUrl;
        }
      })
    );
    setPreviews(map);
  };

  useEffect(() => { load(); }, []);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Invalid file', description: 'Please select a video file.', variant: 'destructive' });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 100MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    setProgress(0);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const path = `reels/${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      setUploading(false);
      toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' });
      return;
    }
    setProgress(100);

    const nextPos = reels.length ? Math.max(...reels.map(r => r.position)) + 1 : 1;
    const { error } = await (supabase as any).from('reels').insert({
      url: path,
      added_by: user.id,
      position: nextPos,
    });
    setUploading(false);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
    if (error) {
      toast({ title: 'Could not save reel', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reel uploaded', description: 'It will appear in the sidebar.' });
    load();
  };

  const deleteReel = async (r: Reel) => {
    // Remove from storage if it's a storage path
    if (!/^https?:\/\//i.test(r.url)) {
      await supabase.storage.from(BUCKET).remove([r.url]);
    }
    const { error } = await (supabase as any).from('reels').delete().eq('id', r.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reel removed' });
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-app-header/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {onBackToChoice && (
              <button
                onClick={onBackToChoice}
                className="rounded-lg p-2 text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <Film size={20} className="text-pink-500" />
            <h1 className="font-display text-lg font-semibold">Reel Portal</h1>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold mb-1">Upload Reel</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select a video file (MP4, MOV, WebM) up to 100MB.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/50 px-4 py-8 cursor-pointer hover:border-primary transition-colors">
            <Upload size={28} className="text-muted-foreground" />
            <span className="text-sm font-medium">
              {uploading ? `Uploading… ${progress}%` : 'Click to choose video'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </div>

        <div className="mt-6">
          <h2 className="font-display text-base font-semibold mb-3">
            Current Reels <span className="text-muted-foreground font-normal">({reels.length})</span>
          </h2>
          {reels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">
              No reels yet. Upload your first one above.
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {reels.map(r => (
                <li
                  key={r.id}
                  className="relative rounded-xl border border-border bg-card overflow-hidden group"
                >
                  <span className="absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-pink-500/90 text-white text-xs font-semibold">
                    #{r.position}
                  </span>
                  {previews[r.id] ? (
                    <video
                      src={previews[r.id]}
                      className="w-full aspect-[9/16] object-cover bg-black"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full aspect-[9/16] flex items-center justify-center bg-muted text-xs text-muted-foreground">
                      Loading…
                    </div>
                  )}
                  <button
                    onClick={() => deleteReel(r)}
                    className="absolute top-2 right-2 rounded-lg p-2 bg-black/60 text-destructive opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity"
                    aria-label="Delete reel"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReelManagerPortal;
