import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type FinishedItem, type Garden } from '@/lib/api';

// ── Elevated Shelf v2 ─────────────────────────────────────────────────────
// A dark wooden library: a stats card (identity · period · streak · activity)
// sitting above three real shelves of vertical spines, with a peek sheet.

const serif = "Georgia, 'Times New Roman', serif";

type Kind = 'journey' | 'byte' | 'summary';
const SHELVES: { key: Kind; label: string; dot: string; labelColor: string; base: string; light: string; w: number; hBase: number }[] = [
  { key: 'journey', label: 'Journeys', dot: '#6360b0', labelColor: '#8d89c4', base: '#45427c', light: '#6f6cbb', w: 32, hBase: 150 },
  { key: 'byte', label: 'Bites', dot: '#c66a47', labelColor: '#c66a47', base: '#a8472f', light: '#cf7551', w: 24, hBase: 132 },
  { key: 'summary', label: 'Summaries', dot: '#928bb0', labelColor: '#a59ec4', base: '#6a6486', light: '#9d96ba', w: 28, hBase: 146 },
];
const KIND_LABEL: Record<Kind, string> = { journey: 'Journey', byte: 'Bite', summary: 'Summary' };

type Period = 'week' | 'month' | 'year' | 'all';
const PERIODS: { key: Period; label: string; heroLabel: string; days: number; buckets: number }[] = [
  { key: 'week', label: 'Week', heroLabel: 'This week in calm', days: 7, buckets: 7 },
  { key: 'month', label: 'Month', heroLabel: 'This month in calm', days: 30, buckets: 5 },
  { key: 'year', label: 'Year', heroLabel: 'Your year in calm', days: 365, buckets: 12 },
  { key: 'all', label: 'All', heroLabel: 'All-time calm', days: Infinity, buckets: 12 },
];

const DAY = 86400000;

// Self-relative progression tier from the user's own finished count — a sense
// of growth with no cross-user cohort to fake. Real, always-positive, grows.
function tierFor(total: number): string | null {
  if (total < 1) return null;
  if (total < 5) return 'Seedling';
  if (total < 15) return 'Grove';
  if (total < 30) return 'Steady';
  if (total < 60) return 'Deep calm';
  return 'Sage';
}

function initials(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Y';
  return (parts[0]![0]! + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Reads + activity bars within a period window, from finished[].completed_at.
function periodStats(finished: FinishedItem[], p: (typeof PERIODS)[number]) {
  const now = Date.now();
  const inWindow = p.days === Infinity
    ? finished
    : finished.filter((f) => f.completed_at && now - new Date(f.completed_at).getTime() <= p.days * DAY);

  // bucket counts (oldest → newest) for the activity chart
  const bars = new Array(p.buckets).fill(0) as number[];
  const spanDays = p.days === Infinity
    ? Math.max(30, (now - new Date(finished[finished.length - 1]?.completed_at ?? now).getTime()) / DAY)
    : p.days;
  for (const f of inWindow) {
    if (!f.completed_at) continue;
    const age = (now - new Date(f.completed_at).getTime()) / DAY; // 0 = today
    const idx = Math.min(p.buckets - 1, Math.max(0, p.buckets - 1 - Math.floor((age / spanDays) * p.buckets)));
    bars[idx] = (bars[idx] ?? 0) + 1;
  }
  return { reads: inWindow.length, bars };
}

// ── one spine ──────────────────────────────────────────────────────────────
function Spine({ item, cfg, onPress }: { item: FinishedItem; cfg: (typeof SHELVES)[number]; onPress: () => void }) {
  const h = cfg.hBase + ((item.title.length * 7) % 14) - 7;
  const lift = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -15 * lift.value }, { scale: 1 + 0.04 * lift.value }] }));
  return (
    <Pressable
      onPressIn={() => { lift.value = withTiming(1, { duration: 130 }); }}
      onPressOut={() => { lift.value = withTiming(0, { duration: 200 }); }}
      onPress={onPress}
      style={{ flex: 0 }}>
      <Animated.View style={[{
        width: cfg.w, height: h, borderRadius: 2, backgroundColor: cfg.base, overflow: 'hidden',
        transformOrigin: 'bottom',
        shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 3 },
      }, st]}>
        {/* light sheen on the left edge + dark seam on the right — gives each
            spine a distinct 3D binding so neighbours read as separate books */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: cfg.light, opacity: 0.7 }} />
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(0,0,0,0.3)' }} />
        {/* decorative bands */}
        <View style={{ position: 'absolute', top: 12, left: 3, right: 3, height: 1.5, backgroundColor: 'rgba(244,236,220,0.4)' }} />
        <View style={{ position: 'absolute', bottom: 11, left: 3, right: 3, height: 1.5, backgroundColor: 'rgba(244,236,220,0.4)' }} />
        {/* vertical title — an inner box sized to the spine's height (so the
            text isn't clamped to the narrow spine width) is centred, then rotated */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: h - 28, height: 16, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '90deg' }] }}>
            <Text numberOfLines={1} style={{ textAlign: 'center', fontFamily: serif, fontSize: 9.5, fontWeight: '500', color: '#f4ecdc', letterSpacing: 0.3 }}>
              {item.title}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── shelf ────────────────────────────────────────────────────────────────────
function Shelf({ cfg, items, onPeek }: { cfg: (typeof SHELVES)[number]; items: FinishedItem[]; onPeek: (it: FinishedItem) => void }) {
  if (items.length === 0) return null;
  return (
    <View>
      <View style={styles.shelfHead}>
        <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
        <Text style={[styles.shelfLabel, { color: cfg.labelColor }]}>{cfg.label}</Text>
        <Text style={styles.shelfCount}>{items.length}</Text>
      </View>
      <View style={{ position: 'relative', marginTop: 6 }}>
        {/* recessed back panel */}
        <View style={styles.backPanel} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-end', gap: cfg.key === 'byte' ? 12 : 14, paddingHorizontal: 24, paddingTop: cfg.key === 'byte' ? 22 : 18 }}>
          {items.map((it) => <Spine key={`${it.kind}-${it.id}`} item={it} cfg={cfg} onPress={() => onPeek(it)} />)}
        </ScrollView>
        {/* wooden plank */}
        <View style={styles.plank}>
          <Text style={styles.plankLabel}>{cfg.label.toLowerCase()}</Text>
        </View>
        <View style={styles.plankEdge} />
      </View>
    </View>
  );
}

// ── main ──────────────────────────────────────────────────────────────────
export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [g, setG] = useState<Garden | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<Period>('year');
  const [peek, setPeek] = useState<FinishedItem | null>(null);

  useFocusEffect(useCallback(() => {
    api.getGarden().then(setG).catch(() => {}).finally(() => setLoaded(true));
  }, []));

  const finished = g?.finished ?? [];
  const byKind = useMemo(() => {
    const m: Record<string, FinishedItem[]> = {};
    for (const it of finished) (m[it.kind] ??= []).push(it);
    return m;
  }, [finished]);

  const total = finished.length;
  const nextMilestone = Math.max(10, Math.ceil((total + 1) / 10) * 10);
  const pcfg = PERIODS.find((p) => p.key === period)!;
  const { reads, bars } = useMemo(() => periodStats(finished, pcfg), [finished, pcfg]);
  const maxBar = Math.max(1, ...bars);
  const sinceYear = useMemo(() => {
    const dates = finished.map((f) => f.completed_at).filter(Boolean).sort();
    return dates[0] ? new Date(dates[0]!).getFullYear() : null;
  }, [finished]);

  const openItem = (it: FinishedItem) => {
    setPeek(null);
    router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#140d07' }}>
      {/* nav */}
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-down" size={24} color="#e8dcc6" /></Pressable>
        <Text style={styles.navTitle}>Your Library</Text>
        <Ionicons name="share-outline" size={20} color="#e8dcc6" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* ── stats card ── */}
        <View style={styles.statsCard}>
          <View style={styles.profileRow}>
            {g?.avatar_url
              ? <View style={styles.avatarWrap}><Ionicons name="person" size={18} color="#fbf3e3" /></View>
              : <View style={styles.avatarWrap}><Text style={styles.avatarTxt}>{initials(g?.display_name)}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{g?.display_name || 'You'}</Text>
              {sinceYear && <Text style={styles.since}>Reading since {sinceYear}</Text>}
            </View>
            {tierFor(total) && (
              <View style={styles.tier}>
                <Ionicons name="leaf" size={11} color="#ecd185" />
                <Text style={styles.tierTxt}>{tierFor(total)}</Text>
              </View>
            )}
          </View>

          {/* period tabs */}
          <View style={styles.tabs}>
            {PERIODS.map((p) => {
              const on = p.key === period;
              return (
                <Pressable key={p.key} onPress={() => { setPeriod(p.key); Haptics.selectionAsync().catch(() => {}); }}
                  style={[styles.tab, on ? styles.tabOn : styles.tabOff]}>
                  <Text style={[styles.tabTxt, { color: on ? '#241b12' : '#9d8a6b' }]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* hero — reads (real). "hours of calm" needs backend (see notes). */}
          <Text style={styles.heroLabel}>{pcfg.heroLabel}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroBig}>{reads}</Text>
            <Text style={styles.heroUnit}>{reads === 1 ? 'read' : 'reads'}</Text>
          </View>

          {/* micro stats */}
          <View style={styles.microRow}>
            <View style={styles.chip}><Text style={styles.chipNum}>{total}</Text><Text style={styles.chipLbl}>finished</Text></View>
            <View style={styles.chip}>
              <Ionicons name="flame" size={12} color="#ecd185" />
              <Text style={styles.chipNum}>{g?.streak ?? 0}</Text><Text style={styles.chipLbl}>day streak</Text>
            </View>
          </View>

          {/* activity chart */}
          <View style={styles.chart}>
            {bars.map((b, i) => (
              <View key={i} style={{ flex: 1, height: `${Math.max(8, (b / maxBar) * 100)}%`, borderRadius: 3, backgroundColor: '#a8472f', opacity: 0.4 + 0.6 * (b / maxBar) }} />
            ))}
          </View>
          <Text style={styles.chartCap}>reads · {period === 'week' ? 'last 7 days' : period === 'month' ? 'last 4 weeks' : period === 'year' ? 'last 12 months' : 'lifetime'}</Text>
        </View>

        {/* ── library header + milestone ── */}
        <View style={styles.libHead}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
            <Text style={styles.libTitle}>Library</Text>
            <Text style={styles.libCount}>{total} finished</Text>
          </View>
          <Ionicons name="filter-outline" size={18} color="#9d8a6b" />
        </View>
        {total > 0 && (
          <View style={{ marginHorizontal: 24, marginTop: 14 }}>
            <View style={styles.mileRow}>
              <Text style={styles.mileTxt}>{nextMilestone - total} reads to your {nextMilestone}th</Text>
              <Text style={styles.mileMeta}>{total} / {nextMilestone}</Text>
            </View>
            <View style={styles.mileTrack}>
              <View style={[styles.mileFill, { width: `${(total / nextMilestone) * 100}%` }]} />
            </View>
          </View>
        )}

        {loaded && total === 0 && <Text style={styles.empty}>Finish a read and its spine appears here.</Text>}

        {/* ── shelves ── */}
        <View style={{ marginTop: 6 }}>
          {SHELVES.map((cfg) => (
            <View key={cfg.key} style={{ marginTop: 18 }}>
              <Shelf cfg={cfg} items={byKind[cfg.key] ?? []} onPeek={setPeek} />
            </View>
          ))}
        </View>

        {total > 0 && <Text style={styles.footer}>Tap a spine to peek · drag a shelf to browse</Text>}
      </ScrollView>

      {/* ── peek sheet ── */}
      <Modal visible={!!peek} transparent animationType="fade" onRequestClose={() => setPeek(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPeek(null)} />
        {peek && (() => {
          const cfg = SHELVES.find((s) => s.key === peek.kind) ?? SHELVES[0]!;
          return (
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
              <View style={styles.grabber} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
                <Text style={styles.peekKind}>{KIND_LABEL[peek.kind as Kind] ?? peek.kind}</Text>
              </View>
              <Text style={styles.peekTitle}>{peek.title}</Text>
              <Text style={styles.peekMeta}>
                Finished{peek.completed_at ? ` · ${new Date(peek.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <Pressable style={styles.peekCta} onPress={() => openItem(peek)}>
                  <Text style={styles.peekCtaTxt}>Read again</Text>
                </Pressable>
                <Pressable style={styles.peekIcon} onPress={() => openItem(peek)}>
                  <Ionicons name="share-outline" size={18} color="#e8dcc6" />
                </Pressable>
              </View>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 4 },
  navTitle: { fontFamily: serif, fontSize: 18, color: '#f4ecdc', letterSpacing: 0.2 },

  statsCard: { marginHorizontal: 18, marginTop: 12, borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(244,236,220,0.09)' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#6360b0', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: serif, fontSize: 16, color: '#fbf3e3' },
  name: { fontFamily: serif, fontSize: 16, color: '#f4ecdc' },
  since: { fontSize: 11, color: '#9d8a6b', marginTop: 2 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 20, backgroundColor: 'rgba(236,209,133,0.13)' },
  tierTxt: { fontSize: 12, fontWeight: '700', color: '#ecd185' },

  tabs: { flexDirection: 'row', gap: 6, marginTop: 16 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 18, alignItems: 'center' },
  tabOn: { backgroundColor: '#efe5d1' },
  tabOff: { backgroundColor: 'rgba(255,255,255,0.05)' },
  tabTxt: { fontSize: 12, fontWeight: '600' },

  heroLabel: { marginTop: 16, fontSize: 10, letterSpacing: 2.6, textTransform: 'uppercase', color: '#9d8a6b', fontWeight: '700' },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 6 },
  heroBig: { fontFamily: serif, fontSize: 46, lineHeight: 46, fontWeight: '600', color: '#f2d98c' },
  heroUnit: { fontFamily: serif, fontSize: 18, color: '#cdbfa3', fontStyle: 'italic' },

  microRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)' },
  chipNum: { fontSize: 13, fontWeight: '700', color: '#f4ecdc' },
  chipLbl: { fontSize: 11, color: '#b6a589' },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 46, marginTop: 16 },
  chartCap: { fontSize: 10, color: '#8c7b60', marginTop: 8, letterSpacing: 0.3 },

  libHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 26 },
  libTitle: { fontFamily: serif, fontSize: 18, color: '#f4ecdc' },
  libCount: { fontSize: 12, color: '#8c7b60' },
  mileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  mileTxt: { fontSize: 11, color: '#b6a589' },
  mileMeta: { fontSize: 11, color: '#8c7b60' },
  mileTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  mileFill: { height: '100%', borderRadius: 3, backgroundColor: '#f2d98c' },

  shelfHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  shelfLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  shelfCount: { fontSize: 11, color: '#7a6a50' },
  backPanel: { position: 'absolute', left: 18, right: 18, top: 8, bottom: 0, borderRadius: 6, backgroundColor: '#1f1610' },
  plank: { height: 14, marginHorizontal: 16, borderRadius: 2, backgroundColor: '#8a6438', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 9, shadowOffset: { width: 0, height: 9 } },
  plankLabel: { position: 'absolute', right: 12, fontSize: 7, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(244,236,220,0.34)', fontWeight: '700' },
  plankEdge: { height: 5, marginHorizontal: 16, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#46321d' },

  empty: { color: '#8c7b60', fontStyle: 'italic', textAlign: 'center', marginTop: 40, fontSize: 13.5, paddingHorizontal: 30 },
  footer: { textAlign: 'center', color: '#8c7b60', fontSize: 11, paddingTop: 26, paddingHorizontal: 30, lineHeight: 16 },

  backdrop: { flex: 1, backgroundColor: 'rgba(10,7,4,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#241a12', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 34, shadowOffset: { width: 0, height: -12 } },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(244,236,220,0.25)', alignSelf: 'center', marginBottom: 18 },
  peekKind: { fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: '#9d8a6b', fontWeight: '700' },
  peekTitle: { fontFamily: serif, fontSize: 25, color: '#f4ecdc', marginTop: 9, lineHeight: 30 },
  peekMeta: { fontSize: 13, color: '#b6a589', marginTop: 7 },
  peekCta: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#ecd185', alignItems: 'center' },
  peekCtaTxt: { color: '#2a1c10', fontWeight: '700', fontSize: 14 },
  peekIcon: { width: 52, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(244,236,220,0.16)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
});
