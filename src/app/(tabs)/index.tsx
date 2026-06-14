import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ContinueItem, type RecItem } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
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

  const [weather, setWeather] = useState<Weather | null>(null);
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cont, setCont] = useState<ContinueItem[]>([]);

  // Refresh "Continue" each time the home regains focus (e.g. after listening).
  useFocusEffect(
    useCallback(() => {
      api.getContinue().then((r) => setCont(r.items.filter((i) => !i.position?.completed))).catch(() => {});
    }, [])
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
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 40 }}>
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

      {cont.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={styles.section}>Continue</Text>
          {cont.slice(0, 2).map((it) => {
            const p = it.position ?? {};
            const ratio =
              p.totalChapters && p.chapterSeq != null
                ? Math.min(1, p.chapterSeq / p.totalChapters)
                : p.durationSec
                ? Math.min(1, (p.audioSec ?? 0) / p.durationSec)
                : 0;
            const sub = p.totalChapters
              ? `Chapter ${p.chapterSeq ?? 0} of ${p.totalChapters}`
              : `${Math.round(ratio * 100)}% · resume`;
            return (
              <Pressable
                key={`${it.kind}-${it.id}`}
                style={styles.continueCard}
                onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } })}>
                <Text style={[styles.tag, { color: typeColors[it.kind] }]}>
                  {TYPE_LABEL[it.kind]} · {sub}
                </Text>
                <Text style={styles.continueTitle} numberOfLines={1}>{it.title}</Text>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: typeColors[it.kind] }]} />
                </View>
              </Pressable>
            );
          })}
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
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  continueTitle: { fontFamily: serif, fontSize: 16, color: colors.ink, marginTop: 3, marginBottom: 8 },
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
