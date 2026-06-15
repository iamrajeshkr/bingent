import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type FinishedItem } from '@/lib/api';
import { colors, serif, typeColors } from '@/lib/theme';

const SLOT = 27; // fixed slot per book → even riffle mapping
const BOOK_W = 24;
const hFor = (t: string, seed: number) => (t === 'journey' ? 116 : t === 'summary' ? 96 : 76) + ((seed * 7) % 12) - 6;

// One book: leans away from the focused book (left of focus → left, right → right);
// the focused book stands straight and peeks up. A second tap slides it down to open.
function Book({ item, idx, focus, lift, onPress }: {
  item: FinishedItem; idx: number; focus: SharedValue<number>; lift: SharedValue<number>; onPress: () => void;
}) {
  const h = hFor(item.kind, item.title.length);
  const bg = typeColors[item.kind] ?? colors.muted;
  const st = useAnimatedStyle(() => {
    'worklet';
    const f = focus.value;
    let rot = 4, ty = 0, sc = 1, z = 1;
    if (f >= 0) {
      if (Math.abs(f - idx) < 0.5) { rot = 0; ty = -16 + lift.value; sc = 1.07; z = 30; }
      else rot = idx < f ? -12 : 12;
    }
    return { zIndex: z, transform: [{ perspective: 600 }, { translateY: ty }, { rotateZ: `${rot}deg` }, { scale: sc }] };
  });
  return (
    <Pressable onPress={onPress} style={{ width: SLOT, alignItems: 'center' }}>
      <Animated.View style={[{ width: BOOK_W, height: h, borderRadius: 3, backgroundColor: bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transformOrigin: 'bottom' }, st]}>
        <View style={[styles.band, { top: 8 }]} />
        <View style={[styles.band, { bottom: 8 }]} />
        <Text numberOfLines={1} style={{ transform: [{ rotate: '90deg' }], width: h - 30, fontFamily: serif, fontSize: 8.5, color: '#FFFFFF', opacity: 0.9, textAlign: 'center' }}>
          {item.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<FinishedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [focusJS, setFocusJS] = useState(-1);

  const focus = useSharedValue(-1);
  const lift = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      api.getGarden().then((g) => setItems(g.finished ?? [])).catch(() => {}).finally(() => setLoaded(true));
    }, [])
  );

  const perRack = Math.max(6, Math.floor((Dimensions.get('window').width - 40) / SLOT));
  const racks: FinishedItem[][] = [];
  for (let i = 0; i < items.length; i += perRack) racks.push(items.slice(i, i + perRack));

  const setFocus = (i: number) => { focus.value = withTiming(i, { duration: 280 }); setFocusJS(i); Haptics.selectionAsync().catch(() => {}); };
  const open = (it: FinishedItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    lift.value = withTiming(64, { duration: 240 }, (done) => {
      if (done) runOnJS(go)(it);
    });
  };
  const go = (it: FinishedItem) => {
    lift.value = 0; focus.value = -1; setFocusJS(-1);
    router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } });
  };
  const pressBook = (absIdx: number, it: FinishedItem) => {
    if (focusJS === absIdx) open(it);
    else setFocus(absIdx);
  };

  // Riffle: drag across a rack to sweep the focus (parting point) along it.
  const rackPan = (start: number, count: number, width: number) =>
    Gesture.Pan().activeOffsetX([-10, 10]).onUpdate((e) => {
      'worklet';
      const rel = Math.max(0, Math.min(count - 1, Math.floor((e.x / width) * count)));
      focus.value = start + rel;
    }).onEnd((e) => {
      'worklet';
      const rel = Math.max(0, Math.min(count - 1, Math.floor((e.x / width) * count)));
      runOnJS(setFocusJS)(start + rel);
    });

  return (
    <View style={{ flex: 1, backgroundColor: '#241B12' }}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-down" size={24} color="#E8DCC6" /></Pressable>
        <Text style={styles.topTitle}>Your library</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 40 }} onScrollBeginDrag={() => focusJS >= 0 && setFocus(-1)}>
        {loaded && items.length === 0 && <Text style={styles.empty}>Finish a read and its spine appears here.</Text>}
        {racks.map((row, r) => {
          const start = r * perRack;
          const width = row.length * SLOT;
          return (
            <View key={r} style={styles.rackWrap}>
              <GestureDetector gesture={rackPan(start, row.length, width)}>
                <View style={[styles.rackRow, { width }]}>
                  {row.map((it, j) => (
                    <Book key={`${it.kind}-${it.id}`} item={it} idx={start + j} focus={focus} lift={lift} onPress={() => pressBook(start + j, it)} />
                  ))}
                </View>
              </GestureDetector>
              <View style={styles.plank} />
            </View>
          );
        })}

        {focusJS >= 0 && items[focusJS] && (
          <View style={styles.focusInfo}>
            <Text style={styles.focusTitle}>{items[focusJS]!.title}</Text>
            <Text style={styles.focusHint}>Tap again to open</Text>
          </View>
        )}
        {loaded && items.length > 0 && (
          <Text style={styles.hint}>Tap a book to lift it · tap again to open · slide across a rack to browse</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: '#F4ECDC' },
  count: { width: 24, textAlign: 'right', fontSize: 13, color: '#B6A589' },
  rackWrap: { alignItems: 'center', marginBottom: 18 },
  rackRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 132 },
  band: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.32)' },
  plank: { height: 13, borderRadius: 3, alignSelf: 'stretch', marginHorizontal: 14, backgroundColor: '#7C5C38', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  focusInfo: { alignItems: 'center', marginTop: 8, paddingHorizontal: 20 },
  focusTitle: { fontFamily: serif, fontSize: 16, color: '#F4ECDC', textAlign: 'center' },
  focusHint: { fontSize: 11, color: '#C9A24A', marginTop: 3 },
  empty: { color: '#B6A589', textAlign: 'center', marginTop: 60, fontFamily: serif, fontStyle: 'italic' },
  hint: { color: '#8C7B60', fontSize: 11, textAlign: 'center', marginTop: 18, paddingHorizontal: 30, lineHeight: 16 },
});
