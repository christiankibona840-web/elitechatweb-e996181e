import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Notification = Tables<'notifications'>;

const NotificationBell = ({ meId }: { meId: string }) => {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', meId)
      .order('created_at', { ascending: false })
      .limit(30);
    setItems(data ?? []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('notifications-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${meId}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev]);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(n.title, { body: n.body ?? undefined });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const unread = items.filter((i) => !i.read).length;

  const markAll = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', meId).eq('read', false);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-app-icon transition-colors hover:bg-muted/30"
        title="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-gold px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-elegant">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="font-display text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-[11px] text-primary">
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">You're all caught up ✨</p>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-border/60 px-4 py-2.5 ${n.read ? '' : 'bg-primary/5'}`}
                  >
                    <p className="text-xs font-semibold text-foreground">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
