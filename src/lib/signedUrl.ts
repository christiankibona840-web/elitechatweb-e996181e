import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'chat-files';
const EXPIRES = 60 * 60 * 24 * 7; // 7 days
const cache = new Map<string, { url: string; ts: number }>();
const inflight = new Map<string, Promise<string>>();

/**
 * Extract the object path if this URL points at our chat-files bucket
 * (either public or sign variant). Returns null for external / non-bucket URLs.
 */
function extractPath(url: string | null | undefined): string | null {
  if (!url) return null;
  // Storage paths (no scheme) — treat as already a path
  if (!/^https?:\/\//i.test(url)) return url.replace(/^\/+/, '');
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/chat-files\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function resolveChatFileUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const path = extractPath(url);
  if (!path) return url; // external URL, return as-is
  const cached = cache.get(path);
  if (cached && Date.now() - cached.ts < (EXPIRES - 3600) * 1000) return cached.url;
  if (inflight.has(path)) return inflight.get(path)!;
  const p = (async () => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRES);
    if (error || !data?.signedUrl) {
      inflight.delete(path);
      return url;
    }
    cache.set(path, { url: data.signedUrl, ts: Date.now() });
    inflight.delete(path);
    return data.signedUrl;
  })();
  inflight.set(path, p);
  return p;
}

export function useSignedUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    const path = extractPath(url);
    if (!path) return url ?? null;
    const cached = cache.get(path);
    return cached ? cached.url : null;
  });
  useEffect(() => {
    let alive = true;
    if (!url) { setResolved(null); return; }
    const path = extractPath(url);
    if (!path) { setResolved(url); return; }
    const cached = cache.get(path);
    if (cached) { setResolved(cached.url); return; }
    resolveChatFileUrl(url).then(u => { if (alive) setResolved(u); });
    return () => { alive = false; };
  }, [url]);
  return resolved;
}
