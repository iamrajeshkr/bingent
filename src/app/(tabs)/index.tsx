import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ContinueItem, type RecItem, type ThreadGroup } from '@/lib/api';
import { usePlayer } from '@/lib/player';
import { usePrefs } from '@/lib/prefs';
import { ensureCatalog } from '@/lib/use-catalog';
import { Skeleton } from '@/components/skeleton';
import { colors, serif, typeColors } from '@/lib/theme';
import { WEATHERS, WEATHER_PHRASE, type Weather } from '@/lib/weather';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const TYPE_LABEL: Record<string, string> = { byte: 'Byte', journey: 'Journey', summary: 'Summary' };

export default function InnerWeatherHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const player = usePlayer();

  const [weather, setWeather] = useState<Weather | null>(null);
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cont, setCont] = useState<ContinueItem[]>([]);
  const [threadList, setThreadList] = useState<ThreadGroup[]>([]);
  const [hydrated, setHydrated] = useState(false); // first load settled — gate skeletons

  // Refresh "Continue" and "Wander" each time the home regains focus (e.g. after
  // finishing something) so freshly-completed items drop out of both. The theme
  // search is server-cached, so this is a cheap call.
  useFocusEffect(
    useCallback(() => {
      ensureCatalog().catch(() => {}); // warm the cache so the first tap-to-play is instant
      const a = api.getContinue().then((r) => setCont(r.items.filter((i) => !i.position?.completed))).catch(() => {});
      const b = api.getThreads(prefs.language).then((r) => setThreadList(r.threads)).catch(() => {});
      Promise.allSettled([a, b]).finally(() => setHydrated(true));
    }, [prefs.language])
  );

  const choose = async (w: Weather) => {
    setWeather(w);
    setLoading(true);
    setError(null);
    // Record the check-in (fire-and-forget) and fetch a weather-shaped shelf.
    api.setWeather({ weather: w, local_hour: new Date().getHours() }).catch(() => {});
    try {
      const { items } = await api.recommend({ weather: w, limit: 5 });
      setRecs(items);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // `/composed` and `/sit` are new routes; typedRoutes regenerates their types
  // on dev-server start, so cast until then.
  const openPage = () =>
    weather &&
    router.push({ pathname: '/composed', params: { weather, intent: prefs.intent ?? '' } } as unknown as Href);
  const openSit = () =>
    weather && router.push({ pathname: '/sit', params: { weather } } as unknown as Href);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 96 }}>
      <Text style={styles.kicker}>{greeting()}</Text>
      <Text style={styles.h1}>How is it inside today?</Text>

      <View style={styles.weatherRow}>
        {WEATHERS.map((w) => {
          const active = weather === w.key;
          return (
            <Pressable
              key={w.key}
              onPress={() => choose(w.key)}
              style={[styles.chip, active && { borderColor: w.tint, borderWidth: 1.5, backgroundColor: colors.indigoSoft }]}>
              <Ionicons name={w.icon} size={20} color={active ? w.tint : colors.muted} />
              <Text style={[styles.chipText, active && { color: w.tint }]}>{w.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!weather && (
        <Text style={styles.hint}>Tap how it feels — your page changes with it.</Text>
      )}

      {!hydrated && (
        <View style={{ marginTop: 20 }}>
          <Skeleton width={96} height={16} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Skeleton width={190} height={104} radius={14} />
            <Skeleton width={190} height={104} radius={14} />
          </View>
          <Skeleton width={96} height={16} style={{ marginTop: 26 }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Skeleton width={132} height={120} radius={12} />
            <Skeleton width={132} height={120} radius={12} />
            <Skeleton width={132} height={120} radius={12} />
          </View>
        </View>
      )}

      {cont.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={styles.section}>Continue</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
            {cont.slice(0, 8).map((it) => {
              const p = it.position ?? {};
              const ratio =
                p.totalChapters && p.chapterSeq != null
                  ? Math.min(1, p.chapterSeq / p.totalChapters)
                  : p.durationSec
                  ? Math.min(1, (p.audioSec ?? 0) / p.durationSec)
                  : 0;
              const sub = p.totalChapters
                ? `Ch ${p.chapterSeq ?? 0}/${p.totalChapters}`
                : `${Math.round(ratio * 100)}%`;
              return (
                <View key={`${it.kind}-${it.id}`} style={styles.continueCard}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } })}>
                    <Text style={[styles.tag, { color: typeColors[it.kind] }]}>{TYPE_LABEL[it.kind]} · {sub}</Text>
                    <Text style={styles.continueTitle} numberOfLines={2}>{it.title}</Text>
                  </Pressable>
                  <View style={styles.track}>
                    <View style={[styles.trackFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: typeColors[it.kind] }]} />
                  </View>
                  <Pressable
                    style={styles.resume}
                    onPress={() =>
                      player.playItem(it.kind, it.id, {
                        lang: prefs.language,
                        // We already know where they left off — skip the extra lookup.
                        ...(it.kind !== 'journey' ? { startAtSec: p.audioSec ?? 0 } : {}),
                      })
                    }>
                    <Ionicons name="play" size={11} color="#FFFFFF" />
                    <Text style={styles.resumeText}>Resume</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {weather && (
        <>
          <Pressable style={styles.today} onPress={openPage}>
            <Text style={[styles.tag, { color: colors.indigo }]}>
              Chosen for a {weather} {new Date().getHours() >= 17 ? 'evening' : 'day'}
            </Text>
            <View style={styles.todayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayTitle}>Tonight's page</Text>
                <Text style={styles.meta}>Written for you · read or listen</Text>
              </View>
              <View style={styles.playCircle}>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </View>
            </View>
          </Pressable>

          <Pressable style={styles.sitBtn} onPress={openSit}>
            <Ionicons name="leaf-outline" size={16} color={colors.indigo} />
            <Text style={styles.sitText}>Begin today's sit · 6 min</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.indigo} />
          </Pressable>

          {loading && <ActivityIndicator color={colors.indigo} style={{ marginTop: 24 }} />}
          {error && <Text style={styles.error}>Couldn't reach Kitab — {error}</Text>}

          {recs.length > 0 && <Text style={styles.section}>For how today feels</Text>}
          {recs.map((r) => (
            <Pressable
              key={`${r.kind}-${r.id}`}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
              onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: r.kind, id: r.id } })}>
              <View style={[styles.cover, { backgroundColor: typeColors[r.kind] }]}>
                <Ionicons name="book-outline" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTag, { color: typeColors[r.kind] }]}>{TYPE_LABEL[r.kind]}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>{r.title}</Text>
                <Text style={styles.cardReason} numberOfLines={1}>{r.reason}</Text>
              </View>
            </Pressable>
          ))}
        </>
      )}

      {threadList.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.section}>Wander</Text>
          {threadList.map((t) => (
            <View key={t.slug} style={{ marginBottom: 16 }}>
              <Text style={styles.threadTitle}>{t.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
                {t.items.map((it) => (
                  <Pressable
                    key={`${it.kind}-${it.id}`}
                    style={styles.threadCard}
                    onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } })}>
                    <View style={[styles.threadCover, { backgroundColor: typeColors[it.kind] }]}>
                      <Ionicons name="book-outline" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.cardTag, { color: typeColors[it.kind] }]}>{TYPE_LABEL[it.kind]}</Text>
                    <Text style={styles.threadCardTitle} numberOfLines={2}>{it.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '500' },
  h1: { fontFamily: serif, fontSize: 25, color: colors.ink, marginTop: 4, marginBottom: 18 },
  weatherRow: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  chipText: { fontSize: 10.5, color: colors.muted },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 14 },
  today: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
  },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  todayTitle: { fontFamily: serif, fontSize: 19, color: colors.ink },
  tag: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500' },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  playCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.indigoSoft,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  sitText: { flex: 1, fontSize: 13, color: colors.indigo, fontWeight: '500' },
  section: { fontFamily: serif, fontSize: 16, color: colors.ink, marginTop: 22, marginBottom: 10 },
  continueCard: {
    width: 190,
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 13,
  },
  continueTitle: { fontFamily: serif, fontSize: 14.5, lineHeight: 19, color: colors.ink, marginTop: 3, marginBottom: 8, minHeight: 38 },
  resume: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.indigo, borderRadius: 999, paddingVertical: 7, marginTop: 10 },
  resumeText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '500' },
  threadTitle: { fontFamily: serif, fontSize: 14.5, color: colors.ink, marginBottom: 8 },
  threadCard: { width: 132, backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10 },
  threadCover: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  threadCardTitle: { fontFamily: serif, fontSize: 13, lineHeight: 17, color: colors.ink, marginTop: 2 },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  trackFill: { height: 5, borderRadius: 3 },
  error: { color: colors.accent, fontSize: 12.5, marginTop: 16 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cover: { width: 46, height: 60, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTag: { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500' },
  cardTitle: { fontFamily: serif, fontSize: 15, color: colors.ink, marginTop: 2 },
  cardReason: { fontSize: 11, color: colors.muted, marginTop: 3, fontStyle: 'italic' },
});
