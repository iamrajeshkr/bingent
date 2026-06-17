import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '@/lib/player';
import { colors, serif } from '@/lib/theme';

// Tab routes sit above the tab bar; everything else sits near the bottom edge.
const TAB_ROUTES = new Set(['/', '/discover', '/saved', '/you']);
// Hide entirely on these (clean input screens, immersive screens, the full player).
const HIDDEN_EXACT = new Set(['/ask']);
const HIDDEN_PREFIX = ['/player', '/library', '/auth', '/onboarding', '/threshold'];

const SCREEN_W = Dimensions.get('window').width;
const DISMISS_DX = 90; // swipe left past this → dismiss
const EXPAND_DX = 70; // swipe right past this → expand

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { nowPlaying, current, playing, positionSec, durationSec, toggle, stop } = usePlayer();

  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }], opacity: opacity.value }));

  // Reset the bar's transform when a new item starts — otherwise a prior
  // swipe-dismiss would leave it parked off-screen/invisible for the next track.
  const itemId = nowPlaying?.itemId;
  useEffect(() => { tx.value = 0; opacity.value = 1; }, [itemId, tx, opacity]);

  const expand = () => { tap(); router.push('/player' as Href); };
  const dismiss = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); stop(); };
  const onToggle = () => { tap(); toggle(); };

  // All hooks above this line — bail out only after they've run unconditionally.
  if (!nowPlaying || !current) return null;
  if (HIDDEN_EXACT.has(pathname) || HIDDEN_PREFIX.some((p) => pathname.startsWith(p))) return null;

  const bottom = insets.bottom + (TAB_ROUTES.has(pathname) ? 52 : 12);
  const pct = durationSec > 0 ? Math.min(100, (positionSec / durationSec) * 100) : 0;
  const sub = nowPlaying.kind === 'journey' ? nowPlaying.title : nowPlaying.author ?? '';

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12]) // let vertical taps / the play button win until it's clearly horizontal
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      tx.value = e.translationX;
      opacity.value = e.translationX < 0 ? Math.max(0.35, 1 + e.translationX / 260) : 1;
    })
    .onEnd((e) => {
      const left = e.translationX < -DISMISS_DX || e.velocityX < -800;
      const right = e.translationX > EXPAND_DX || e.velocityX > 800;
      if (left) {
        tx.value = withTiming(-SCREEN_W, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, (done) => { if (done) runOnJS(dismiss)(); });
      } else if (right) {
        tx.value = withSpring(0, { damping: 18 });
        opacity.value = withTiming(1, { duration: 150 });
        runOnJS(expand)();
      } else {
        tx.value = withSpring(0, { damping: 18 });
        opacity.value = withTiming(1, { duration: 150 });
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrap, aStyle, { bottom }]}>
        <Pressable style={styles.row} onPress={expand}>
          <View style={styles.cover}>
            {nowPlaying.cover ? (
              <Image source={{ uri: nowPlaying.cover }} style={styles.coverImg} contentFit="cover" />
            ) : (
              <Ionicons name="musical-notes" size={16} color={colors.mutedOnDark} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>{current.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
          </View>
          <Ionicons name="chevron-up" size={15} color={colors.mutedOnDark} />
        </Pressable>
        <Pressable hitSlop={12} onPress={onToggle} style={styles.btn}>
          <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    // subtle lift
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  cover: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.indigo, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverImg: { width: 40, height: 40 },
  title: { fontFamily: serif, fontSize: 13.5, color: colors.inkInverse },
  sub: { fontSize: 10.5, color: colors.mutedOnDark, marginTop: 1 },
  track: { height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 5, overflow: 'hidden' },
  fill: { height: 2, borderRadius: 2, backgroundColor: colors.accent },
  btn: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
});
