import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Avatar from './Avatar';
import { SignedImg, SignedVideo } from './SignedMedia';
import { Plus, Trash2, X, Crown } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface LeadersHubProps {
  me: Profile;
}

interface LeaderPost {
  id: string;
  uploader_id: string;
  leader_name: string;
  caption: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  file_name: string | null;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

const LeadersHub = ({ me }: LeadersHubProps) => {
  const [posts, setPosts] = useState<LeaderPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkAdmin();
    loadPosts();
  }, [me.id]);

  const checkAdmin = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', me.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const loadPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leader_posts')
      .select('*, profiles!leader_posts_uploader_id_fkey(display_name, avatar_url)')
      .order('created_at', { ascending: false });
    setPosts((data as any) || []);
    setLoading(false);
  };

  const upload = async () => {
    if (!leaderName.trim()) { toast.error('Enter the leader name'); return; }
    if (!file) { toast.error('Choose a photo or video'); return; }
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) { toast.error('Only photos or videos allowed'); return; }
    if (file.size > 100 * 1024 * 1024) { toast.error('Max file size is 100MB'); return; }

    setUploading(true);
    const path = `leaders/${me.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('chat-files').upload(path, file);
    if (upErr) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path);

    const { error } = await supabase.from('leader_posts').insert({
      uploader_id: me.id,
      leader_name: leaderName.trim(),
      caption: caption.trim() || null,
      media_url: urlData.publicUrl,
      media_type: isVideo ? 'video' : 'image',
      file_name: file.name,
    });
    if (error) { toast.error(error.message || 'Failed to save'); }
    else {
      toast.success('Leader post uploaded!');
      setLeaderName(''); setCaption(''); setFile(null); setShowCreate(false);
      loadPosts();
    }
    setUploading(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('leader_posts').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Deleted');
    loadPosts();
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Crown size={14} className="text-primary" /> Leaders Hub
        </h3>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/80 transition-colors"
            title={showCreate ? 'Cancel' : 'Upload leader photo/video'}
          >
            {showCreate ? <X size={16} /> : <Plus size={16} />}
          </button>
        )}
      </div>

      {showCreate && isAdmin && (
        <div className="p-4 border-b border-border bg-accent/20">
          <input
            className="bg-app-input-bg text-foreground border border-transparent rounded-lg px-3 py-2 text-sm focus:border-primary transition-colors placeholder:text-muted-foreground outline-none w-full mb-2"
            placeholder="Leader name (e.g. Chairman John)"
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
          />
          <textarea
            className="bg-app-input-bg text-foreground border border-transparent rounded-lg px-3 py-2 text-sm focus:border-primary transition-colors placeholder:text-muted-foreground outline-none w-full mb-2 resize-none"
            placeholder="Caption (optional)"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <div className="flex items-center gap-2 mb-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Plus size={14} /> {file ? file.name : 'Choose photo or video'}
            </label>
            {file && (
              <button onClick={() => setFile(null)} className="text-destructive text-xs">
                Remove
              </button>
            )}
          </div>
          <button
            onClick={upload}
            disabled={uploading}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 w-full"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground text-sm py-10">Loading leaders...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10 px-5 text-muted-foreground">
          <div className="text-4xl mb-3">👑</div>
          <p className="text-sm">
            {isAdmin ? 'No leader posts yet. Tap + to upload the first one.' : 'No leader posts yet.'}
          </p>
        </div>
      ) : (
        posts.map((p) => (
          <div key={p.id} className="border-b border-border">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Avatar name={p.profiles?.display_name || '?'} size={32} avatarUrl={p.profiles?.avatar_url} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{p.leader_name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Posted by {p.profiles?.display_name || 'Admin'} • {fmtDate(p.created_at)}
                  </div>
                </div>
                {(isAdmin || p.uploader_id === me.id) && (
                  <button
                    onClick={() => remove(p.id)}
                    className="text-destructive/60 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {p.caption && <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{p.caption}</p>}
              {p.media_type === 'image' ? (
                <img src={p.media_url} alt={p.leader_name} className="rounded-lg w-full object-cover max-h-72" />
              ) : (
                <video src={p.media_url} controls className="rounded-lg w-full max-h-72" />
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default LeadersHub;
