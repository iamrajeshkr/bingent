import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Arc, type ArcStep } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif, typeColors } from '@/lib/theme';

const tr = (m: Record<string, string> | undefined, lang: string) => m?.[lang] ?? m?.en ?? '';

export default function ArcDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();

  const [arc, setArc] = useState<Arc | null>(null);
  const [steps, setSteps] = useState<ArcStep[]>([]);
  const [enrollment, setEnrollment] = useState<Arc['enrollment']>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.getArc(slug).then((r) => { setArc(r.arc); setSteps(r.steps); setEnrollment(r.enrollment); }).catch(() => {});
  }, [slug]);
  useFocusEffect(load);

  const enroll = async () => {
    setBusy(true);
    try { await api.enrollArc(slug); load(); } finally { setBusy(false); }
  };
  const advance = async () => {
    if (!arc) return;
    setBusy(true);
    try { await api.advanceArc(arc.id); load(); } finally { setBusy(false); }
  };

  if (!arc) {
    return <View style={styles.center}><ActivityIndicator color={colors.indigo} /></View>;
  }

  const current = enrollment?.current_step ?? 0;
  const done = !!enrollment?.completed_at;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 12 }}>
          <Ionicons name="chevron-back" size={22} color={colors.inkInverse} />
        </Pressable>
        <Text style={styles.heroTag}>Becoming · {arc.total_steps} steps</Text>
        <Text style={styles.heroTitle}>{tr(arc.title, prefs.language)}</Text>
        <Text style={styles.heroSub}>{tr(arc.subtitle, prefs.language)}</Text>
        {enrollment && (
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((current / arc.total_steps) * 100)}%` }]} /></View>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        {!enrollment ? (
          <Pressable style={styles.cta} onPress={enroll} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Begin this arc</Text>}
          </Pressable>
        ) : done ? (
          <Text style={styles.doneNote}>You've completed this arc. 🌿</Text>
        ) : (
          <Pressable style={styles.cta} onPress={advance} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Mark step {current + 1} done & continue</Text>}
          </Pressable>
        )}

        <Text style={styles.stepsHeader}>Steps</Text>
        {steps.map((s) => {
          const isCurrent = enrollment && !done && s.step_index === current + 1;
          const isPast = enrollment && s.step_index <= current;
          return (
            <Pressable
              key={s.step_index}
              disabled={!s.item}
              onPress={() => s.item && router.push({ pathname: '/item/[type]/[id]', params: { type: s.item.kind, id: s.item.id } })}
              style={[styles.step, isCurrent && { borderColor: colors.indigo, borderWidth: 1.5 }]}>
              <View style={[styles.stepNum, isPast && { backgroundColor: colors.indigo }]}>
                {isPast ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : <Text style={styles.stepNumText}>{s.step_index}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle} numberOfLines={1}>{s.item?.title ?? tr(s.title, prefs.language)}</Text>
                {s.item && <Text style={[styles.stepKind, { color: typeColors[s.item.kind] }]}>{s.item.kind}</Text>}
              </View>
              {s.item && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
            </Pressable>
          );
        })}
        {steps.length === 0 && <Text style={styles.empty}>This arc's steps are being prepared.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hero: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  heroTag: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500', color: colors.accent },
  heroTitle: { fontFamily: serif, fontSize: 23, color: colors.inkInverse, marginTop: 6 },
  heroSub: { fontSize: 12.5, color: colors.mutedOnDark, marginTop: 4, marginBottom: 12 },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  cta: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '500' },
  doneNote: { fontFamily: serif, fontSize: 16, color: colors.indigo, textAlign: 'center', paddingVertical: 8 },
  stepsHeader: { fontFamily: serif, fontSize: 17, color: colors.ink, marginTop: 22, marginBottom: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  stepTitle: { fontFamily: serif, fontSize: 14.5, color: colors.ink },
  stepKind: { fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  empty: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
});
