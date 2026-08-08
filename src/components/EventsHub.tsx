import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SignedImg } from './SignedMedia';
import { CalendarDays, MapPin, Plus, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  cover_url: string | null;
  created_by: string;
}

interface EventItem extends EventRow {
  going: number;
  attending: boolean;
}

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const EventsHub = ({ me }: { me: Profile }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const [{ data: rows }, { data: rsvps }] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, description, location, starts_at, cover_url, created_by')
        .order('starts_at', { ascending: true }),
      supabase.from('event_rsvps').select('event_id, user_id'),
    ]);
    const list = (rows ?? []) as EventRow[];
    setEvents(
      list.map((e) => {
        const mine = (rsvps ?? []).filter((r) => r.event_id === e.id);
        return { ...e, going: mine.length, attending: mine.some((r) => r.user_id === me.id) };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', me.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
    load();
    const ch = supabase
      .channel('events-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  const toggleRsvp = async (e: EventItem) => {
    if (e.attending) {
      await supabase.from('event_rsvps').delete().eq('event_id', e.id).eq('user_id', me.id);
    } else {
      await supabase.from('event_rsvps').insert({ event_id: e.id, user_id: me.id });
    }
    load();
  };

  const removeEvent = async (e: EventItem) => {
    if (!window.confirm(`Delete "${e.title}"?`)) return;
    const { error } = await supabase.from('events').delete().eq('id', e.id);
    if (error) return toast.error(error.message);
    if (e.cover_url && !/^https?:\/\//i.test(e.cover_url)) {
      const clean = e.cover_url.replace(/^chat-images\//, '');
      await supabase.storage.from('chat-images').remove([clean]);
    }
    toast.success('Event deleted');
    load();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          <h2 className="font-display text-base font-bold text-foreground">Events</h2>
          <span className="text-xs font-medium text-muted-foreground">{events.length}</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-gold px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-gold"
          >
            <Plus size={14} /> New
          </button>
        )}
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Loading events…</p>
      ) : events.length === 0 ? (
        <div className="p-8 text-center">
          <CalendarDays size={34} className="mx-auto mb-2 text-primary" />
          <p className="font-display text-base font-semibold text-foreground">No events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? 'Create the first one.' : 'Check back soon.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 p-3">
          {events.map((e) => {
            const past = new Date(e.starts_at).getTime() < Date.now();
            return (
              <li key={e.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover-lift">
                {e.cover_url && (
                  <SignedImg src={e.cover_url} alt={e.title} className="h-40 w-full object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-foreground">{e.title}</h3>
                    {isAdmin && (
                      <button onClick={() => removeEvent(e)} aria-label="Delete event" className="text-destructive">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <CalendarDays size={13} /> {fmtWhen(e.starts_at)}
                    {past && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Past</span>}
                  </p>
                  {e.location && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                      <MapPin size={13} /> {e.location}
                    </p>
                  )}
                  {e.description && (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/85">{e.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => toggleRsvp(e)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                        e.attending
                          ? 'bg-gradient-gold text-primary-foreground shadow-gold'
                          : 'border border-border bg-muted/40 text-foreground hover:bg-muted'
                      }`}
                    >
                      {e.attending ? "You're going" : "I'm going"}
                    </button>
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Users size={13} /> {e.going} going
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <CreateEvent meId={me.id} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
};

const CreateEvent = ({ meId, onClose, onDone }: { meId: string; onClose: () => void; onDone: () => void }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !startsAt) {
      toast.error('Title and date/time are required');
      return;
    }
    setBusy(true);
    try {
      let coverPath: string | null = null;
      if (cover) {
        const ext = cover.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `events/${meId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('chat-images')
          .upload(path, cover, { contentType: cover.type });
        if (upErr) throw upErr;
        coverPath = `chat-images/${path}`;
      }
      const { error } = await supabase.from('events').insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        cover_url: coverPath,
        created_by: meId,
      });
      if (error) throw error;
      toast.success('Event published 🎉');
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not create event');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-elegant"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-foreground">New event</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="w-full rounded-2xl bg-app-input-bg px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-2xl bg-app-input-bg px-4 py-2.5 text-sm text-foreground outline-none"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-full rounded-2xl bg-app-input-bg px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's happening?"
            rows={3}
            className="w-full resize-none rounded-2xl bg-app-input-bg px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-border bg-background/50 px-4 py-5 text-sm font-medium text-foreground hover:border-primary transition-colors">
            {cover ? cover.name : 'Add a cover image (optional)'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-gradient-gold py-2.5 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-50"
        >
          {busy ? 'Publishing…' : 'Publish event'}
        </button>
      </div>
    </div>
  );
};

export default EventsHub;
