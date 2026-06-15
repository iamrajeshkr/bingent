import { useEffect, useState } from 'react';
import { fetchCatalog } from './content';
import type { CatalogItem } from './types';

let cache: CatalogItem[] | null = null;
let inflight: Promise<CatalogItem[]> | null = null;

// Load the catalog once and memoise. Safe to call repeatedly — concurrent
// callers share one request.
export function ensureCatalog(): Promise<CatalogItem[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchCatalog()
      .then((data) => { cache = data; inflight = null; return data; })
      .catch((e) => { inflight = null; throw e; });
  }
  return inflight;
}

// The raw content row for an item if the catalog is already loaded, else null.
// Bites/summaries carry their audio in the list payload, so this is enough to
// start playback without a per-item fetch; journeys do not (no chapters here).
export function getCachedRow(kind: string, id: string): any | null {
  return cache?.find((i) => i.type === kind && i.id === id)?.raw ?? null;
}

export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) { setItems(cache); return; }
    let alive = true;
    ensureCatalog()
      .then((data) => alive && setItems(data))
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => { alive = false; };
  }, []);

  return { items, error, loading: items === null && !error };
}
