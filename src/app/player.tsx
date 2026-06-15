import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '@/lib/player';
import { colors, serif } from '@/lib/theme';

const RATES = [1, 1.25, 1.5, 1.75];
const SLEEPS = [0, 5, 10, 15, 30, 45];
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
};

export default function NowPlaying() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = usePlayer();
  const barWidth = useRef(1);

  // ── Sleep timer ───────────────────────────────────────────────────────
  // sleepEnd is an absolute timestamp (Date.now() + minutes*60000).
  // A 1-second interval counts down the display; when it hits 0, we pause.
  const [sleepEnd, setSleepEnd] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState(0); // seconds remaining
  const sleepChoice = useRef(0); // last chosen option (for cycling the chip)
  const toggleRef = useRef(p.toggle);
  toggleRef.current = p.toggle;
  const playingRef = useRef(p.playing);
  playingRef.current = p.playing;

  const startSleep = useCallback((minutes: number) => {
    sleepChoice.current = minutes;
    if (minutes === 0) {
      setSleepEnd(null);
      setSleepLeft(0);
      return;
    }
    const end = Date.now() + minutes * 60_000;
    setSleepEnd(end);
    setSleepLeft(minutes * 60);
  }, []);

  // Tick every second while a sleep timer is active.
  useEffect(() => {
    if (sleepEnd == null) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((sleepEnd - Date.now()) / 1000));
      setSleepLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        setSleepEnd(null);
        setSleepLeft(0);
        sleepChoice.current = 0;
        // Pause playback
        if (playingRef.current) toggleRef.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepEnd]);

  const cycleSleep = () => {
    const idx = SLEEPS.indexOf(sleepChoice.current);
    const next = SLEEPS[(idx + 1) % SLEEPS.length];
    startSleep(next);
  };

  const sleepActive = sleepEnd != null && sleepLeft > 0;
  const sleepLabel = sleepActive
    ? sleepLeft >= 60
      ? `${Math.floor(sleepLeft / 60)}:${(sleepLeft % 60).toString().padStart(2, '0')}`
      : `${sleepLeft}s`
    : 'Sleep';

  // ─────────────────────────────────────────────────────────────────────

  if (!p.nowPlaying || !p.current) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.mutedBig}>Nothing playing.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}><Text style={styles.link}>Go back</Text></Pressable>
      </View>
    );
  }

  const isJourney = p.nowPlaying.kind === 'journey';
  const pct = p.durationSec > 0 ? p.positionSec / p.durationSec : 0;
  const upNext = isJourney ? p.queue.map((t, i) => ({ t, i })).filter((x) => x.i > p.index) : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-down" size={24} color={colors.mutedOnDark} /></Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{isJourney ? p.nowPlaying.title : 'Now playing'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.cover}>
        {p.nowPlaying.cover ? <Image source={{ uri: p.nowPlaying.cover }} style={styles.coverImg} contentFit="cover" /> : <Ionicons name="musical-notes" size={44} color={colors.mutedOnDark} />}
      </View>

      <Text style={styles.title}>{p.current.title}</Text>
      <Text style={styles.author}>{isJourney ? `Ch ${p.index + 1} of ${p.queue.length}` : p.nowPlaying.author ?? ''}</Text>

      <Pressable
        onLayout={(e: LayoutChangeEvent) => (barWidth.current = e.nativeEvent.layout.width)}
        onPress={(e) => p.durationSec > 0 && p.seek((e.nativeEvent.locationX / barWidth.current) * p.durationSec)}
        style={styles.trackHit}>
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, pct * 100)}%` }]} /></View>
      </Pressable>
      <View style={styles.times}><Text style={styles.time}>{fmt(p.positionSec)}</Text><Text style={styles.time}>{fmt(p.durationSec)}</Text></View>

      <View style={styles.controls}>
        {isJourney ? (
          <Pressable onPress={p.prev} hitSlop={10}><Ionicons name="play-skip-back" size={26} color={colors.inkInverse} /></Pressable>
        ) : (
          <Pressable onPress={() => p.skip(-15)} hitSlop={10}><Ionicons name="play-back" size={26} color={colors.inkInverse} /></Pressable>
        )}
        <Pressable onPress={p.toggle} style={styles.playBtn}>
          <Ionicons name={p.playing ? 'pause' : 'play'} size={30} color="#FFFFFF" />
        </Pressable>
        {isJourney ? (
          <Pressable onPress={p.next} hitSlop={10}><Ionicons name="play-skip-forward" size={26} color={colors.inkInverse} /></Pressable>
        ) : (
          <Pressable onPress={() => p.skip(15)} hitSlop={10}><Ionicons name="play-forward" size={26} color={colors.inkInverse} /></Pressable>
        )}
      </View>

      <View style={styles.chips}>
        <Pressable style={styles.chip} onPress={() => p.setRate(RATES[(RATES.indexOf(p.rate) + 1) % RATES.length])}>
          <Text style={styles.chipText}>{p.rate}×</Text>
        </Pressable>
        <Pressable style={[styles.chip, sleepActive && styles.chipOn]} onPress={cycleSleep}>
          <Ionicons name="moon" size={12} color={sleepActive ? colors.accent : colors.mutedOnDark} />
          <Text style={[styles.chipText, sleepActive && { color: colors.accent }]}>{sleepLabel}</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: p.nowPlaying!.kind, id: p.nowPlaying!.itemId } } as unknown as Href)}>
          <Ionicons name="book-outline" size={12} color={colors.mutedOnDark} />
          <Text style={styles.chipText}>Read along</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => p.setLang(p.nowPlaying!.lang === 'en' ? 'hi' : 'en')}>
          <Text style={styles.chipText}>{p.nowPlaying.lang === 'en' ? 'हिंदी' : 'English'}</Text>
        </Pressable>
        <Pressable style={[styles.chip, p.autoplay && styles.chipOn]} onPress={() => p.setAutoplay(!p.autoplay)}>
          <Ionicons name="infinite" size={12} color={p.autoplay ? colors.accent : colors.mutedOnDark} />
          <Text style={[styles.chipText, p.autoplay && { color: colors.accent }]}>Autoplay</Text>
        </Pressable>
      </View>

      {upNext.length > 0 && (
        <View style={{ marginTop: 26 }}>
          <Text style={styles.upNext}>Up next</Text>
          {upNext.map(({ t, i }) => (
            <Pressable key={i} style={styles.row} onPress={() => p.jumpTo(i)}>
              <Text style={styles.rowNum}>{i + 1}</Text>
              <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {p.upNext.length > 0 && (
        <View style={{ marginTop: 26 }}>
          <Text style={styles.upNext}>More like this</Text>
          {p.upNext.map((it) => (
            <Pressable key={`${it.kind}:${it.id}`} style={styles.simRow} onPress={() => p.playItem(it.kind, it.id)}>
              <View style={styles.simCover}>
                {it.cover ? <Image source={{ uri: it.cover }} style={styles.simCoverImg} contentFit="cover" /> : <Ionicons name="musical-notes" size={14} color={colors.mutedOnDark} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{it.title}</Text>
                {it.author ? <Text style={styles.simAuthor} numberOfLines={1}>{it.author}</Text> : null}
              </View>
              <Ionicons name="play" size={16} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  mutedBig: { color: colors.mutedOnDark, fontFamily: serif, fontSize: 16 },
  link: { color: colors.accent, fontSize: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.mutedOnDark, marginHorizontal: 8 },
  cover: { width: 200, height: 200, borderRadius: 20, backgroundColor: colors.indigo, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginVertical: 22 },
  coverImg: { width: 200, height: 200 },
  title: { fontFamily: serif, fontSize: 21, color: colors.inkInverse, textAlign: 'center' },
  author: { fontSize: 12.5, color: colors.mutedOnDark, textAlign: 'center', marginTop: 3 },
  trackHit: { paddingVertical: 10, marginTop: 18 },
  track: { height: 4, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 3, backgroundColor: colors.accent },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 10.5, color: colors.mutedOnDark },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, marginVertical: 18 },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderColor: 'rgba(255,255,255,0.25)', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  chipOn: { borderColor: colors.accent },
  chipText: { fontSize: 11.5, color: colors.inkInverse },
  upNext: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.mutedOnDark, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  rowNum: { width: 16, textAlign: 'center', fontSize: 11, color: colors.mutedOnDark },
  rowTitle: { flex: 1, fontFamily: serif, fontSize: 14, color: colors.inkInverse },
  simRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  simCover: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.indigo, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  simCoverImg: { width: 38, height: 38 },
  simAuthor: { fontSize: 11, color: colors.mutedOnDark, marginTop: 1 },
});
