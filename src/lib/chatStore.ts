const COLORS = ['#00a884','#3fc1cb','#7b66ff','#ff6b6b','#ffa94d','#74c0fc','#f06595'];

export function avatarColor(name: string): string {
  return COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];
}

export function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export type Presence = 'active' | 'idle' | 'offline';

/**
 * Active   = heartbeat within the last 5 minutes (really interacting with the app)
 * Idle     = still flagged online but no heartbeat for 5+ minutes (forgot to sign out / tab left open)
 * Offline  = signed out
 */
export const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function getPresence(isOnline?: boolean | null, lastSeen?: string | null): Presence {
  if (!isOnline) return 'offline';
  if (!lastSeen) return 'idle';
  const ageMs = Date.now() - new Date(lastSeen).getTime();
  return ageMs < ACTIVE_WINDOW_MS ? 'active' : 'idle';
}


export function fmtDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/** True only when the user has a fresh heartbeat (really in the app right now). */
export function isActiveNow(isOnline?: boolean | null, lastSeen?: string | null): boolean {
  return getPresence(isOnline, lastSeen) === 'active';
}

/** Human readable "last seen" text derived from the real heartbeat timestamp. */
export function fmtLastSeen(lastSeen?: string | null, isOnline?: boolean | null): string {
  if (isActiveNow(isOnline, lastSeen)) return 'online';
  if (!lastSeen) return 'offline';
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
  if (diff < 1) return 'last seen just now';
  if (diff < 60) return `last seen ${diff}m ago`;
  if (diff < 1440) return `last seen ${Math.floor(diff / 60)}h ago`;
  if (diff < 43200) return `last seen ${Math.floor(diff / 1440)}d ago`;
  return `last seen ${new Date(lastSeen).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
