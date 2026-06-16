import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appear } from '@/components/appear';
import { BookCover } from '@/components/book-cover';
import { ResumeRibbon } from '@/components/resume';
import { Skeleton } from '@/components/skeleton';
import { api, type ContinueItem, type RecItem, type ThreadGroup } from '@/lib/api';
import { usePlayer } from '@/lib/player';
import { usePrefs } from '@/lib/prefs';
import { onCompletion, getAllLocal } from '@/lib/sync-queue';
import { colors, serif, typeColors } from '@/lib/theme';
import { ensureCatalog } from '@/lib/use-catalog';
import { WEATHERS, WEATHER_PHRASE, type Weather } from '@/lib/weather';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TYPE_LABEL: Record<string, string> = { byte: 'Byte', journey: 'Journey', summary: 'Summary' };

function PlayDot({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.playDot} hitSlop={8}>
      <Ionicons name="play" size={18} color="#FFFFFF" />
    </Pressable>
  );
}

export default function Shelf() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const player = usePlayer();

  const [weather, setWeather] = useState<Weather | null>(null);
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [cont, setCont] = useState<ContinueItem[]>([]);
  const [threadList, setThreadList] = useState<ThreadGroup[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore today's persisted weather on mount.
  useEffect(() => {
    if (prefs.ready && prefs.todayWeather && !weather && recs.length === 0) {
      setWeather(prefs.todayWeather);
      setRecsLoading(true);
      api.recommend({ weather: prefs.todayWeather, limit: 5 })
        .then(({ items }) => setRecs(items))
        .catch(() => {})
        .finally(() => setRecsLoading(false));
    }
  }, [prefs.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to completion events: immediately remove finished items.
  useEffect(() => {
    return onCompletion((kind, id) => {
      setCont((prev) => prev.filter((c) => !(c.kind === kind && c.id === id)));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      ensureCatalog().catch(() => {});
      const a = api
        .getContinue()
        .then((r) => {
          // Merge server data with any local writes that haven't synced yet.
          const local = getAllLocal();
          const merged = r.items.map((i) => {
            const localPos = local.get(`${i.kind}:${i.id}`);
            if (localPos && (localPos.audioSec ?? 0) > (i.position?.audioSec ?? 0)) {
              return { ...i, position: localPos };
            }
            return i;
          });
          setCont(
            merged.filter((i) => {
              const p = i.position;
              // mirror the server: journeys show once started; bites/summaries need 30s
              return p?.completed !== true && (i.kind === 'journey' || (p?.audioSec ?? 0) >= 30);
            })
          );
        })
        .catch(() => {});
      const b = api.getThreads(prefs.language).then((r) => setThreadList(r.threads)).catch(() => {});
      Promise.allSettled([a, b]).finally(() => setHydrated(true));
    }, [prefs.language])
  );

  const choose = async (w: Weather) => {
    setWeather(w);
    // Persist for the day so we don't ask again.
    const today = new Date().toISOString().slice(0, 10);
    prefs.set({ todayWeather: w, todayWeatherDate: today });
    setRecsLoading(true);
    api.setWeather({ weather: w, local_hour: new Date().getHours() }).catch(() => {});
    try {
      const { items } = await api.recommend({ weather: w, limit: 5 });
      setRecs(items);
    } finally {
      setRecsLoading(false);
    }
  };

  const hero = recs[0];
  const openItem = (kind: RecItem['kind'], id: string) =>
    router.push({ pathname: '/item/[type]/[id]', params: { type: kind, id } });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 96 }}>
      {/* greeting */}
      <Text style={styles.kicker}>{WEEKDAY[new Date().getDay()]} · {greeting()}</Text>
      <Text style={styles.h1}>What will you carry{'\n'}into today?</Text>
      {weather ? (
        <Text style={styles.lede}>You said you're {WEATHER_PHRASE[weather]}. Here is something gentle.</Text>
      ) : (
        <Text style={styles.lede}>How is it inside today? Your page changes with it.</Text>
      )}

      {/* mood check-in (only until chosen — once per day) */}
      {!weather && (
        <View style={styles.moodRow}>
          {WEATHERS.map((w) => (
            <Pressable key={w.key} onPress={() => choose(w.key)} style={styles.moodPill}>
              <Ionicons name={w.icon} size={18} color={colors.muted} />
              <Text style={styles.moodText}>{w.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* today's page hero — only after weather is chosen */}
      {recsLoading && !hero ? (
        <Skeleton height={104} radius={20} style={{ marginTop: 18 }} />
      ) : hero ? (
        <Appear>
          <Pressable style={styles.hero} onPress={() => openItem(hero.kind, hero.id)}>
            <View style={styles.heroGlow} />
            <BookCover item={{ type: hero.kind, title: hero.title, author: hero.author, cover: hero.cover }} w={66} r={8} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTag}>Today's page</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
              <Text style={styles.heroSub} numberOfLines={1}>{hero.reason || 'Read or listen'}</Text>
            </View>
            <PlayDot onPress={() => player.playItem(hero.kind, hero.id, { lang: prefs.language })} />
          </Pressable>
        </Appear>
      ) : null}

      {/* sit ritual */}
      {weather && (
        <Pressable
          style={styles.sit}
          onPress={() => router.push({ pathname: '/sit', params: { weather } } as unknown as Href)}>
          <Ionicons name="leaf-outline" size={16} color={colors.indigo} />
          <Text style={styles.sitText}>Begin today's sit · 6 min</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.indigo} />
        </Pressable>
      )}

      {/* first-load skeletons for the rails below */}
      {!hydrated && (
        <View style={{ marginTop: 22 }}>
          <Skeleton width={170} height={16} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <Skeleton width={170} height={104} radius={16} />
            <Skeleton width={170} height={104} radius={16} />
          </View>
        </View>
      )}

      {/* continue — single primary ResumeRibbon only */}
      {cont.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Pick up where you paused</Text>
            <Pressable
              style={styles.continueLink}
              onPress={() => router.push('/continue' as Href)}
              hitSlop={8}>
              <Text style={styles.sectionMeta}>{cont.length} open</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.muted} />
            </Pressable>
          </View>
          {(() => {
            const primary = cont[0]!;
            const resume = (it: ContinueItem) =>
              player.playItem(it.kind, it.id, {
                lang: prefs.language,
                ...(it.kind !== 'journey' ? { startAtSec: it.position?.audioSec ?? 0 } : {}),
              });
            return (
              <ResumeRibbon it={primary} onOpen={() => openItem(primary.kind, primary.id)} onPlay={() => resume(primary)} />
            );
          })()}
        </View>
      )}

      {/* wander */}
      {threadList.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.section}>Wander</Text>
          {threadList.slice(0, 3).map((t) => (
            <View key={t.slug} style={{ marginBottom: 18 }}>
              <Text style={styles.threadTitle}>{t.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
                {t.items.slice(0, 6).map((it) => (
                  <Pressable key={`${it.kind}-${it.id}`} style={{ width: 92 }} onPress={() => openItem(it.kind, it.id)}>
                    <BookCover item={{ type: it.kind, title: it.title, author: it.author, cover: it.cover }} w={92} r={9} />
                    <Text style={styles.threadCardTitle} numberOfLines={2}>{it.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      )}

      {(cont.length > 0 || threadList.length > 0) && (
        <Text style={styles.footer}>— that's your page for today —</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '500' },
  h1: { fontFamily: serif, fontSize: 27, lineHeight: 32, color: colors.ink, marginTop: 6, marginBottom: 4 },
  lede: { fontSize: 12.5, color: colors.muted, fontStyle: 'italic', fontFamily: serif },
  moodRow: { flexDirection: 'row', gap: 6, marginTop: 16, flexWrap: 'wrap' },
  moodPill: {
    flexGrow: 1, alignItems: 'center', gap: 4, backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 6,
  },
  moodText: { fontSize: 10.5, color: colors.muted },
  hero: {
    marginTop: 18, backgroundColor: colors.ink, borderRadius: 20, padding: 16,
    flexDirection: 'row', gap: 14, alignItems: 'center', overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(199,91,57,0.28)' },
  heroTag: { fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: '#E8B45E', fontWeight: '700' },
  heroTitle: { fontFamily: serif, fontSize: 19, color: colors.inkInverse, marginTop: 4, marginBottom: 5, lineHeight: 23 },
  heroSub: { fontSize: 12, color: colors.mutedOnDark, fontStyle: 'italic', fontFamily: serif },
  playDot: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sit: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.indigoSoft,
    borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12,
  },
  sitText: { flex: 1, fontSize: 13, color: colors.indigo, fontWeight: '600' },
  section: { fontFamily: serif, fontSize: 16, color: colors.ink, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  sectionMeta: { fontSize: 11, color: colors.muted },
  continueLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  threadTitle: { fontFamily: serif, fontSize: 14.5, color: colors.ink, marginBottom: 9 },
  threadCardTitle: { fontFamily: serif, fontSize: 11.5, color: colors.ink, marginTop: 6, lineHeight: 15 },
  footer: { textAlign: 'center', fontStyle: 'italic', fontFamily: serif, color: colors.muted, fontSize: 12.5, marginTop: 8 },
});
