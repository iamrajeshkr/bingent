/**
 * Write-ahead progress queue.
 *
 * Every progress save is persisted to AsyncStorage *first*, then pushed to the
 * server.  If the network call fails the entry stays in the queue and is retried
 * on app foreground, on a 30-second interval, and (for completions) immediately
 * with exponential backoff.
 *
 * The queue also doubles as a **local progress cache**: any screen can call
 * `getLocal(kind, id)` to get the freshest position we know about — even if
 * the server hasn't acknowledged it yet.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { api, type Position } from './api';
import type { ItemType } from './types';

// ---- types ----------------------------------------------------------------

interface QueueEntry {
  kind: ItemType;
  id: string;
  position: Position;
  /** ISO timestamp of when this entry was enqueued. */
  ts: string;
  /** Number of failed attempts so far. */
  attempts: number;
}

// ---- storage key ----------------------------------------------------------

const QUEUE_KEY = 'kitab.sync-queue.v1';

// ---- in-memory state ------------------------------------------------------

/** Pending entries keyed by `kind:id` (only the latest per item matters). */
let pending = new Map<string, QueueEntry>();
/** Whether we've loaded from AsyncStorage yet. */
let hydrated = false;
/** Interval handle for the periodic flush. */
let flushTimer: ReturnType<typeof setInterval> | null = null;

// ---- completion subscribers -----------------------------------------------

type CompletionListener = (kind: ItemType, id: string) => void;
const completionListeners = new Set<CompletionListener>();

export function onCompletion(fn: CompletionListener) {
  completionListeners.add(fn);
  return () => { completionListeners.delete(fn); };
}

function notifyCompletion(kind: ItemType, id: string) {
  completionListeners.forEach((fn) => { try { fn(kind, id); } catch { /* */ } });
}

// ---- persistence ----------------------------------------------------------

function persist() {
  const arr = Array.from(pending.values());
  AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(arr)).catch(() => {});
}

async function hydrate() {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) {
      const arr: QueueEntry[] = JSON.parse(raw);
      for (const e of arr) pending.set(`${e.kind}:${e.id}`, e);
    }
  } catch { /* corrupt data — start fresh */ }
  hydrated = true;
}

// ---- core API -------------------------------------------------------------

/** Enqueue a progress save.  Writes locally first, then attempts the API call. */
export async function enqueue(kind: ItemType, id: string, position: Position) {
  await hydrate();

  const key = `${kind}:${id}`;
  const entry: QueueEntry = { kind, id, position, ts: new Date().toISOString(), attempts: 0 };
  pending.set(key, entry);
  persist();

  if (position.completed) {
    // Critical path: retry up to 3× with backoff before giving up to the
    // periodic flush.  Completion must land in the DB ASAP.
    const ok = await retryWithBackoff(entry, 3);
    if (ok) {
      pending.delete(key);
      persist();
      notifyCompletion(kind, id);
    }
  } else {
    // Best-effort single attempt for intermediate saves.
    try {
      await api.saveProgress(kind, id, position);
      // Only remove if still the same version (a newer write may have landed).
      if (pending.get(key)?.ts === entry.ts) {
        pending.delete(key);
        persist();
      }
    } catch {
      // Will be retried by the periodic flush.
    }
  }
}

/** Read the latest locally-cached position for an item (may be ahead of server). */
export function getLocal(kind: ItemType, id: string): Position | null {
  const e = pending.get(`${kind}:${id}`);
  return e?.position ?? null;
}

/** Read all locally-cached positions (for merging with server data on focus). */
export function getAllLocal(): Map<string, Position> {
  const out = new Map<string, Position>();
  for (const [key, entry] of pending) out.set(key, entry.position);
  return out;
}

// ---- flush (retry all pending) --------------------------------------------

async function flush() {
  await hydrate();
  if (pending.size === 0) return;

  const entries = Array.from(pending.entries());
  const toRemove: string[] = [];

  await Promise.allSettled(
    entries.map(async ([key, entry]) => {
      try {
        await api.saveProgress(entry.kind, entry.id, entry.position);
        toRemove.push(key);
        if (entry.position.completed) notifyCompletion(entry.kind, entry.id);
      } catch {
        entry.attempts += 1;
      }
    })
  );

  for (const k of toRemove) pending.delete(k);
  if (toRemove.length > 0) persist();
}

// ---- retry with exponential backoff (for critical saves) ------------------

async function retryWithBackoff(entry: QueueEntry, maxAttempts: number): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await api.saveProgress(entry.kind, entry.id, entry.position);
      return true;
    } catch {
      entry.attempts += 1;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** i, 4000)));
      }
    }
  }
  return false;
}

// ---- lifecycle (call once from the root provider) -------------------------

export function startSyncQueue() {
  hydrate();

  // Periodic flush every 30s.
  if (!flushTimer) {
    flushTimer = setInterval(flush, 30_000);
  }

  // Flush on app foreground.
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') flush();
  });

  // Initial flush for anything left over from a crash/kill.
  flush();

  return () => {
    sub.remove();
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  };
}
