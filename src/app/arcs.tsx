import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Arc } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';

const tr = (m: Record<string, string>, lang: string) => m?.[lang] ?? m?.en ?? '';

export default function Arcs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const [arcs, setArcs] = useState<Arc[] | null>(null);

  useEffect(() => {
    api.getArcs().then((r) => setArcs(r.arcs)).catch(() => setArcs([]));
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: 40 }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 12 }}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.kicker}>Becoming</Text>
      <Text style={styles.h1}>Arcs to grow through</Text>
      <Text style={styles.sub}>Multi-step journeys you move through, a little each day.</Text>

      {arcs === null && <ActivityIndicator color={colors.indigo} style={{ marginTop: 30 }} />}

      {arcs?.map((a) => {
        const enrolled = a.enrollment;
        const pct = enrolled ? Math.round((enrolled.current_step / a.total_steps) * 100) : 0;
        return (
          <Pressable
            key={a.slug}
            style={styles.card}
            onPress={() => router.push(`/arc/${a.slug}` as Href)}>
            <Text style={styles.tag}>{a.total_steps} steps{a.goal_weather ? ` · toward ${a.goal_weather}` : ''}</Text>
            <Text style={styles.title}>{tr(a.title, prefs.language)}</Text>
            <Text style={styles.subtitle}>{tr(a.subtitle, prefs.language)}</Text>
            {enrolled ? (
              <>
                <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
                <Text style={styles.meta}>{enrolled.completed_at ? 'Completed ✓' : `Step ${enrolled.current_step} of ${a.total_steps}`}</Text>
              </>
            ) : (
              <Text style={styles.meta}>Tap to begin</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '500' },
  h1: { fontFamily: serif, fontSize: 25, color: colors.ink, marginTop: 3 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 6, marginBottom: 18 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, marginBottom: 12 },
  tag: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.indigo, fontWeight: '500' },
  title: { fontFamily: serif, fontSize: 19, color: colors.ink, marginTop: 4 },
  subtitle: { fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: 10 },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: colors.indigo },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 7 },
});
