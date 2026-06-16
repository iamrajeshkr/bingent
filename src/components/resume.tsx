import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BookCover } from '@/components/book-cover';
import type { ContinueItem } from '@/lib/api';
import { usePlayer } from '@/lib/player';
import { colors, serif, typeColors } from '@/lib/theme';

const TYPE_LABEL: Record<string, string> = { byte: 'Byte', summary: 'Summary', journey: 'Journey' };

function calc(it: ContinueItem) {
  const p = it.position ?? {};
  // For journeys, show within-chapter progress (how far into the current chapter).
  // For non-journeys, show overall audio progress.
  const pct = p.durationSec
    ? Math.min(1, (p.audioSec ?? 0) / p.durationSec)
    : 0;
  const minLeft = p.durationSec ? Math.max(1, Math.floor((p.durationSec - (p.audioSec ?? 0)) / 60)) : null;
  return { p, pct, minLeft };
}

// Three small bars that pulse at different speeds to indicate "currently playing".
function EqBars({ color, size }: { color: string; size: number }) {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.5)).current;
  const a3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = (v: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(v, { toValue: 0.2, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
    const l1 = loop(a1, 400);
    const l2 = loop(a2, 550);
    const l3 = loop(a3, 350);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, [a1, a2, a3]);

  const barW = Math.max(2, size * 0.12);
  const gap = Math.max(1, size * 0.06);
  const maxH = size * 0.55;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap, height: maxH }}>
      {[a1, a2, a3].map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: barW,
            borderRadius: barW / 2,
            backgroundColor: color,
            height: v.interpolate({ inputRange: [0, 1], outputRange: [maxH * 0.25, maxH] }),
          }}
        />
      ))}
    </View>
  );
}

export function RingPlay({
  pct, size = 50, ring = '#E2A24A', track = 'rgba(255,255,255,0.18)', core = '#E2A24A', glyph = '#1F4A45', sw = 3, isPlaying = false, onPress,
}: {
  pct: number; size?: number; ring?: string; track?: string; core?: string; glyph?: string; sw?: number; isPlaying?: boolean; onPress?: () => void;
}) {
  const r = size / 2 - sw / 2 - 0.5;
  const C = 2 * Math.PI * r;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={ring} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, pct)))} />
      </Svg>
      <View style={{ position: 'absolute', top: sw + 2, left: sw + 2, right: sw + 2, bottom: sw + 2, borderRadius: size, backgroundColor: core, alignItems: 'center', justifyContent: 'center' }}>
        {isPlaying ? (
          <EqBars color={glyph} size={size * 0.55} />
        ) : (
          <Ionicons name="play" size={size * 0.32} color={glyph} />
        )}
      </View>
    </Pressable>
  );
}

// Slim primary resume row — cover, type/chapter, title, minutes left, ring-play.
// Reads live position from the player when this item is actively playing.
export function ResumeRibbon({ it, onOpen, onPlay }: { it: ContinueItem; onOpen: () => void; onPlay: () => void }) {
  const player = usePlayer();
  const isThisPlaying = player.nowPlaying?.itemId === it.id && player.nowPlaying?.kind === it.kind;

  // Use live position from player if this item is currently loaded, otherwise fall back to snapshot.
  const livePct = isThisPlaying && player.durationSec > 0
    ? Math.min(1, player.positionSec / player.durationSec)
    : null;
  const liveMinLeft = isThisPlaying && player.durationSec > 0
    ? Math.max(1, Math.floor((player.durationSec - player.positionSec) / 60))
    : null;

  const { p, pct: snapshotPct, minLeft: snapshotMinLeft } = calc(it);
  const pct = livePct ?? snapshotPct;
  const minLeft = liveMinLeft ?? snapshotMinLeft;
  const isJourney = it.kind === 'journey';

  const handlePress = () => {
    if (isThisPlaying && player.playing) {
      player.toggle(); // pause
    } else {
      onPlay();
    }
  };

  return (
    <Pressable onPress={onOpen} style={styles.ribbon}>
      <View style={styles.glow} />
      <BookCover item={{ type: it.kind, title: it.title, cover: it.cover }} w={48} r={6} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.kicker}>
          {isJourney ? `Journey · ch ${p.chapterNum ?? p.chapterSeq ?? 1} of ${p.totalChapters ?? '–'}` : `${TYPE_LABEL[it.kind]} · ${Math.round(pct * 100)}%`}
        </Text>
        <Text numberOfLines={1} style={styles.title}>{it.title}</Text>
        <View style={styles.row}>
          {isJourney && p.section ? (
            <Text numberOfLines={1} style={styles.next}>{p.section}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {minLeft != null && (
            <View style={styles.minWrap}>
              <Ionicons name="time-outline" size={11} color="#E2A24A" />
              <Text style={styles.min}>{minLeft} min left</Text>
            </View>
          )}
        </View>
      </View>
      <RingPlay pct={pct} isPlaying={isThisPlaying && player.playing} onPress={handlePress} />
    </Pressable>
  );
}

// Tiny secondary resume chip with a mini progress ring.
export function MiniResume({ it, onOpen, onPlay }: { it: ContinueItem; onOpen: () => void; onPlay: () => void }) {
  const player = usePlayer();
  const isThisPlaying = player.nowPlaying?.itemId === it.id && player.nowPlaying?.kind === it.kind;

  const livePct = isThisPlaying && player.durationSec > 0
    ? Math.min(1, player.positionSec / player.durationSec)
    : null;
  const liveMinLeft = isThisPlaying && player.durationSec > 0
    ? Math.max(1, Math.floor((player.durationSec - player.positionSec) / 60))
    : null;

  const { p, pct: snapshotPct, minLeft: snapshotMinLeft } = calc(it);
  const pct = livePct ?? snapshotPct;
  const minLeft = liveMinLeft ?? snapshotMinLeft;
  const col = typeColors[it.kind] ?? colors.muted;

  const handlePress = () => {
    if (isThisPlaying && player.playing) {
      player.toggle();
    } else {
      onPlay();
    }
  };

  return (
    <Pressable onPress={onOpen} style={styles.mini}>
      <RingPlay pct={pct} size={28} ring={col} track={colors.track} core={col} glyph="#fff" sw={2.5} isPlaying={isThisPlaying && player.playing} onPress={handlePress} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.miniTitle}>{it.title}</Text>
        <Text numberOfLines={1} style={styles.miniMeta}>
          {it.kind === 'journey' ? `ch ${p.chapterNum ?? p.chapterSeq ?? 1}` : `${Math.round(pct * 100)}%`}{minLeft != null ? ` · ${minLeft} min left` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ribbon: { backgroundColor: '#1F4A45', borderRadius: 16, padding: 11, flexDirection: 'row', gap: 12, alignItems: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(226,162,74,0.18)' },
  kicker: { fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: '#E2A24A', fontWeight: '700' },
  title: { fontFamily: serif, fontSize: 15, color: '#E9EFDF', marginTop: 2, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  next: { flex: 1, minWidth: 0, fontSize: 10.5, color: '#A7C1B7', fontStyle: 'italic', fontFamily: serif },
  minWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  min: { color: '#E2A24A', fontSize: 10, fontWeight: '700' },
  mini: { flex: 1, flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 9, minWidth: 0 },
  miniTitle: { fontFamily: serif, fontSize: 12.5, color: colors.ink },
  miniMeta: { fontSize: 9.5, color: colors.muted, marginTop: 1 },
});
