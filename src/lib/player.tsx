import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type CatalogRef, type Position } from './api';
import { playChime } from './chime';
import { fetchItem } from './content';
import { clearAll as clearPrefetch, localFor, prefetch } from './prefetch';
import { buildQueue, type NowPlaying, type Track } from './queue';
import { enqueue as syncEnqueue, startSyncQueue } from './sync-queue';
import { getCachedRow } from './use-catalog';
import type { ItemType, Lang } from './types';

interface PlayItemOpts { lang?: Lang; startIndex?: number; startAtSec?: number; row?: any; fresh?: boolean }

interface PlayerState {
  nowPlaying: NowPlaying | null;
  queue: Track[];
  index: number;
  current: Track | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  rate: number;
  loading: boolean;
  upNext: CatalogRef[];
  autoplay: boolean;
  setAutoplay: (on: boolean) => void;
  playItem: (kind: ItemType, id: string, opts?: PlayItemOpts) => Promise<void>;
  toggle: () => void;
  seek: (sec: number) => void;
  skip: (delta: number) => void;
  next: () => void;
  prev: () => void;
  jumpTo: (i: number) => void;
  stop: () => void;
  setRate: (r: number) => void;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<PlayerState | null>(null);
export const usePlayer = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer must be used within PlayerProvider');
  return c;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [rate, setRateState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [upNext, setUpNext] = useState<CatalogRef[]>([]);
  const [autoplay, setAutoplayState] = useState(true);

  const pendingSeek = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const finished = useRef(false);
  const preparedNext = useRef<{ kind: ItemType; id: string } | null>(null);
  const autoplayRef = useRef(true);

  useEffect(() => {
    // shouldPlayInBackground keeps audio alive when the screen locks or the app
    // backgrounds (without it, playback suspends until the lock-screen control is
    // tapped). doNotMix is required by expo-audio for lock-screen controls.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
    // Wipe any prefetched audio left over from a previous run.
    clearPrefetch();
    // Start the write-ahead sync queue (flushes on foreground + every 30s).
    const stopQueue = startSyncQueue();
    return stopQueue;
  }, []);

  const setAutoplay = useCallback((on: boolean) => { autoplayRef.current = on; setAutoplayState(on); }, []);

  const setLockScreen = useCallback((np: NowPlaying, track: Track) => {
    try {
      (player as any).setActiveForLockScreen?.(true, {
        title: track.title,
        artist: np.kind === 'journey' ? np.title : np.author ?? 'Bingent',
        artworkUrl: np.cover ?? undefined,
      });
    } catch {
      /* web / unsupported */
    }
  }, [player]);

  const loadTrack = useCallback(
    (tracks: Track[], i: number, startAt: number, np: NowPlaying) => {
      const t = tracks[i];
      if (!t) return;
      pendingSeek.current = startAt;
      setIndex(i);
      // Play from the prefetched local copy if we have one — instant, no buffer.
      player.replace({ uri: localFor(t.url) ?? t.url });
      player.play();
      setLockScreen(np, t);
      // Warm the next chapter well before this one ends, so journeys never stall.
      if (np.kind === 'journey') {
        const nextUrl = tracks[i + 1]?.url;
        if (nextUrl) prefetch(nextUrl);
      }
    },
    [player, setLockScreen]
  );

  // Once a freshly-loaded track is ready, seek to the saved position (once).
  useEffect(() => {
    if (status.isLoaded && pendingSeek.current != null) {
      const s = pendingSeek.current;
      pendingSeek.current = null;
      if (s > 1) player.seekTo(s);
    }
  }, [status.isLoaded, player]);

  const playItem = useCallback(
    async (kind: ItemType, id: string, opts: PlayItemOpts = {}) => {
      setLoading(true);
      try {
        const lang = opts.lang ?? 'en';
        // Resolve the content row with the fewest round-trips: a row handed in by
        // the caller (e.g. the open detail screen) > the in-memory catalog (covers
        // bites/summaries, which carry audio in the list payload) > a fetch.
        // Journeys need their chapter audio, which the catalog list omits.
        const provided = opts.row ?? getCachedRow(kind, id);
        const playable =
          provided?.audio && (kind !== 'journey' || provided.audio.en?.chapters || provided.audio.hi?.chapters);
        const row = playable ? provided : await fetchItem(kind, id);
        const { nowPlaying: np, tracks } = buildQueue(kind, row, lang);
        if (!tracks.length) return; // no audio for this item/lang

        let startIndex = opts.startIndex ?? 0;
        let startAt = opts.startAtSec ?? 0;
        // Skip the saved-position lookup when the caller told us where to start
        // (Continue / read-along) or asked for a fresh start (autoplay).
        if (opts.startIndex == null && opts.startAtSec == null && !opts.fresh) {
          const prog = await api.getProgress(kind, id).catch(() => ({ position: null as Position | null }));
          const p = prog.position;
          // A finished item (replayed from search/detail) starts fresh from the
          // top — otherwise we'd resume at the very end and instantly re-finish.
          if (p && p.completed !== true) {
            if (kind === 'journey' && p.chapterSeq != null) {
              const fi = tracks.findIndex((t) => t.chapterSeq === p.chapterSeq);
              if (fi >= 0) { startIndex = fi; startAt = p.audioSec ?? 0; }
            } else if (kind !== 'journey') {
              startAt = p.audioSec ?? 0;
            }
          }
        }
        setNowPlaying(np);
        setQueue(tracks);
        loadTrack(tracks, startIndex, startAt, np);
      } finally {
        setLoading(false);
      }
    },
    [loadTrack]
  );

  // Up-next ("more like this") — fetched once per item. We also prepare and
  // prefetch the top result so end-of-item autoplay (and the jump to a fresh
  // journey when one ends) begins with no buffering.
  useEffect(() => {
    if (!nowPlaying) { setUpNext([]); preparedNext.current = null; return; }
    let cancelled = false;
    const { kind, itemId, lang } = nowPlaying;
    api
      .getSimilar(kind, itemId, lang)
      .then(async (r) => {
        if (cancelled) return;
        setUpNext(r.items);
        const first = r.items[0];
        preparedNext.current = first ? { kind: first.kind, id: first.id } : null;
        if (first) {
          try {
            const row = await fetchItem(first.kind, first.id);
            const { tracks } = buildQueue(first.kind, row, lang);
            if (tracks[0]?.url) prefetch(tracks[0].url);
          } catch {
            /* prefetch is best-effort */
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [nowPlaying?.kind, nowPlaying?.itemId, nowPlaying?.lang]);

  // Throttled progress save (~every 5s of playback).
  useEffect(() => {
    if (!nowPlaying || !status.isLoaded || status.duration <= 0) return;
    if (Math.abs(status.currentTime - lastSaved.current) >= 5) {
      lastSaved.current = status.currentTime;
      const t = queue[index];
      const position: Position =
        nowPlaying.kind === 'journey'
          ? { chapterSeq: t?.chapterSeq, chapterNum: index + 1, section: t?.section, totalChapters: queue.length, audioSec: status.currentTime, durationSec: status.duration }
          : { audioSec: status.currentTime, durationSec: status.duration };
      syncEnqueue(nowPlaying.kind, nowPlaying.itemId, position);
    }
  }, [status.currentTime, status.isLoaded, status.duration, nowPlaying, queue, index]);

  // Auto-advance journeys; mark complete at the end.
  useEffect(() => {
    if (!status.didJustFinish) {
      finished.current = false;
      return;
    }
    if (finished.current || !nowPlaying) return;
    finished.current = true;
    if (nowPlaying.kind === 'journey' && index < queue.length - 1) {
      loadTrack(queue, index + 1, 0, nowPlaying); // next chapter (already prefetched)
    } else {
      // Whole item finished: mark complete, ring the chime, then autoplay the
      // prepared up-next (prefetched, so it starts instantly) if enabled.
      const t = queue[index];
      syncEnqueue(nowPlaying.kind, nowPlaying.itemId, {
        audioSec: status.duration,
        durationSec: status.duration,
        completed: true,
        ...(nowPlaying.kind === 'journey' ? { chapterSeq: t?.chapterSeq, chapterNum: index + 1, totalChapters: queue.length } : {}),
      });
      playChime();
      const nx = preparedNext.current;
      if (autoplayRef.current && nx) {
        // let the chime breathe; start fresh (skip progress lookup) and lean on
        // the prefetched audio so the next piece begins instantly
        setTimeout(() => playItem(nx.kind, nx.id, { fresh: true }), 1200);
      }
    }
  }, [status.didJustFinish, nowPlaying, queue, index, status.duration, loadTrack, playItem]);

  const value: PlayerState = {
    nowPlaying,
    queue,
    index,
    current: queue[index] ?? null,
    playing: status.playing,
    positionSec: status.currentTime,
    durationSec: status.duration,
    rate,
    loading,
    upNext,
    autoplay,
    setAutoplay,
    playItem,
    toggle: () => (status.playing ? player.pause() : player.play()),
    seek: (sec) => player.seekTo(Math.max(0, sec)),
    skip: (delta) => player.seekTo(Math.max(0, Math.min(status.duration || 0, status.currentTime + delta))),
    next: () => nowPlaying && index < queue.length - 1 && loadTrack(queue, index + 1, 0, nowPlaying),
    prev: () => (status.currentTime > 3 ? player.seekTo(0) : nowPlaying && index > 0 && loadTrack(queue, index - 1, 0, nowPlaying)),
    jumpTo: (i) => nowPlaying && i >= 0 && i < queue.length && loadTrack(queue, i, 0, nowPlaying),
    stop: () => {
      player.pause();
      try { (player as any).clearLockScreenControls?.(); } catch { /* */ }
      setNowPlaying(null);
      setQueue([]);
      setIndex(0);
      setUpNext([]);
      preparedNext.current = null;
      clearPrefetch();
    },
    setRate: (r) => { player.setPlaybackRate(r); setRateState(r); },
    setLang: (l) => {
      if (nowPlaying) playItem(nowPlaying.kind, nowPlaying.itemId, { lang: l, startIndex: index, startAtSec: status.currentTime });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
