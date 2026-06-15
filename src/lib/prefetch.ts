import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// Audio prefetch cache. We download the *upcoming* track to disk while the
// current one plays, so advancing (next chapter / autoplay) starts instantly
// instead of buffering. Strictly bounded: an LRU of MAX_FILES, wiped on stop and
// on app start — prefetched audio is ephemeral and never allowed to pile up.

const MAX_FILES = 5;
const isWeb = Platform.OS === 'web';

const map = new Map<string, string>(); // remote url -> local file uri
const order: string[] = []; // LRU, oldest first
let dir: Directory | null = null;

function ext(url: string): string {
  const m = (url.split('?')[0] ?? '').match(/\.(mp3|m4a|aac|wav|ogg)$/i);
  return m ? m[0].toLowerCase() : '.mp3';
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function ensureDir(): Directory | null {
  if (isWeb) return null;
  try {
    if (!dir) dir = new Directory(Paths.cache, 'kitab-audio');
    if (!dir.exists) dir.create({ intermediates: true });
    return dir;
  } catch {
    return null;
  }
}

function evict() {
  while (order.length > MAX_FILES) {
    const u = order.shift();
    if (!u) break;
    const uri = map.get(u);
    map.delete(u);
    if (uri) try { new File(uri).delete(); } catch { /* already gone */ }
  }
}

/** Cached local uri for a remote url, or null if not prefetched. */
export function localFor(url?: string | null): string | null {
  return url ? map.get(url) ?? null : null;
}

/** Download `url` to the cache (no-op if already present, on web, or on error). */
export async function prefetch(url?: string | null): Promise<string | null> {
  if (!url || isWeb) return null;
  const hit = map.get(url);
  if (hit) return hit;
  const d = ensureDir();
  if (!d) return null;
  try {
    const dest = new File(d, hash(url) + ext(url));
    if (!dest.exists) await File.downloadFileAsync(url, dest);
    map.set(url, dest.uri);
    order.push(url);
    evict();
    return dest.uri;
  } catch {
    return null;
  }
}

/** Wipe the whole prefetch cache (player stop / app start). */
export function clearAll() {
  map.clear();
  order.length = 0;
  if (isWeb) return;
  try {
    const d = dir ?? new Directory(Paths.cache, 'kitab-audio');
    if (d.exists) d.delete();
  } catch {
    /* nothing to clear */
  }
  dir = null;
}
