import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRef } from 'react';
import { colors } from '@/lib/theme';

function fmt(secs: number) {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioBar({
  url,
  startAt = 0,
  onFinish,
  onProgress,
}: {
  url: string;
  startAt?: number;
  onFinish?: () => void;
  onProgress?: (sec: number, dur: number) => void;
}) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const barWidth = useRef(1);
  const finished = useRef(false);
  const seeked = useRef(false);
  const lastReported = useRef(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Resume: once loaded, seek to the saved position (once).
  useEffect(() => {
    if (status.isLoaded && startAt > 1 && !seeked.current) {
      seeked.current = true;
      player.seekTo(startAt);
    }
  }, [status.isLoaded, startAt, player]);

  useEffect(() => {
    if (status.didJustFinish && !finished.current) {
      finished.current = true;
      onFinish?.();
    }
    if (status.playing) finished.current = false;
  }, [status.didJustFinish, status.playing, onFinish]);

  // Report progress ~every 5s of playback (throttled) for cross-device resume.
  useEffect(() => {
    if (!onProgress || status.duration <= 0) return;
    if (Math.abs(status.currentTime - lastReported.current) >= 5) {
      lastReported.current = status.currentTime;
      onProgress(status.currentTime, status.duration);
    }
  }, [status.currentTime, status.duration, onProgress]);

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.playBtn}
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color="#FFFFFF" />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Pressable
          onLayout={(e: LayoutChangeEvent) => (barWidth.current = e.nativeEvent.layout.width)}
          onPress={(e) => {
            const frac = e.nativeEvent.locationX / barWidth.current;
            if (status.duration > 0) player.seekTo(frac * status.duration);
          }}
          style={styles.trackHit}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </View>
        </Pressable>
        <View style={styles.times}>
          <Text style={styles.time}>{fmt(status.currentTime)}</Text>
          <Text style={styles.time}>{fmt(status.duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackHit: { paddingVertical: 8 },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 5, backgroundColor: colors.accent, borderRadius: 3 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 10.5, color: colors.muted },
});
