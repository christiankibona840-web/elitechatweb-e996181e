import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const MEDIA_BUCKETS = ['chat-files', 'chat-images', 'chat-videos'] as const;
const DEFAULT_BUCKET = 'chat-files';
const EXPIRES = 60 * 60 * 24 * 7; // 7 days
const cache = new Map<string, { url: string; ts: number }>();
const inflight = new Map<string, Promise<string>>();

/**
 * Resolve a stored value to { bucket, path } when it points at one of our
 * private storage buckets. Returns null for external / non-bucket URLs.
 * Supported formats:
 *  - "chat-images/uid/123.jpg"  (bucket-prefixed path)
 *  - "reels/uid/123.mp4"        (bare path -> chat-files)
 *  - "https://.../storage/v1/object/public|sign/<bucket>/<path>"
 */
function extractRef(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    const clean = url.replace(/^\/+/, '');
    const bucket = MEDIA_BUCKETS.find((b) => clean.startsWith(`${b}/`));
    if (bucket) return { bucket, path: clean.slice(bucket.length + 1) };
    return { bucket: DEFAULT_BUCKET, path: clean };
  }
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  const bucket = m[1];
  if (!(MEDIA_BUCKETS as readonly string[]).includes(bucket)) return null;
  return { bucket, path: decodeURIComponent(m[2]) };
}

export async function resolveChatFileUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const ref = extractRef(url);
  if (!ref) return url; // external URL, return as-is
  const key = `${ref.bucket}/${ref.path}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < (EXPIRES - 3600) * 1000) return cached.url;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, EXPIRES);
    inflight.delete(key);
    if (error || !data?.signedUrl) return url;
    cache.set(key, { url: data.signedUrl, ts: Date.now() });
    return data.signedUrl;
  })();
  inflight.set(key, p);
  return p;
}

export function useSignedUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    const ref = extractRef(url);
    if (!ref) return url ?? null;
    return cache.get(`${ref.bucket}/${ref.path}`)?.url ?? null;
  });
  useEffect(() => {
    let alive = true;
    if (!url) { setResolved(null); return; }
    const ref = extractRef(url);
    if (!ref) { setResolved(url); return; }
    const cached = cache.get(`${ref.bucket}/${ref.path}`);
    if (cached) { setResolved(cached.url); return; }
    resolveChatFileUrl(url).then((u) => { if (alive) setResolved(u); });
    return () => { alive = false; };
  }, [url]);
  return resolved;
}
