import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type MirrorSnapshot } from '@/lib/api';
import { colors, serif } from '@/lib/theme';

// The Mirror — Bingent's evolving self-portrait of who you're becoming.
export default function MirrorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [latest, setLatest] = useState<MirrorSnapshot | null>(null);
  const [first, setFirst] = useState<MirrorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .getMirror()
      .then(({ latest, first }) => {
        setLatest(latest);
        setFirst(first);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const compose = async () => {
    setGenerating(true);
    setError(null);
    try {
      const snap = await api.generateMirror();
      setLatest(snap);
      if (!first) setFirst(snap);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setGenerating(false);
    }
  };

  const traits = latest ? Object.entries(latest.traits ?? {}) : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: 40 }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 12 }}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.kicker}>Your portrait</Text>
      <Text style={styles.h1}>Who you're becoming</Text>

      {loading && <ActivityIndicator color={colors.indigo} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !latest && (
        <View style={styles.empty}>
          <Ionicons name="aperture-outline" size={32} color={colors.indigo} />
          <Text style={styles.emptyText}>
            Bingent is still getting to know you. Read a little, leave a reflection or two, then
            compose your first portrait.
          </Text>
          <Pressable style={styles.cta} onPress={compose} disabled={generating}>
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Compose my portrait</Text>
            )}
          </Pressable>
        </View>
      )}

      {latest && (
        <>
          <View style={styles.bloom}>
            <View style={[styles.ring, { width: 120, height: 120, borderColor: colors.indigoSoft }]} />
            <View style={[styles.ring, { width: 84, height: 84, borderColor: colors.indigo, borderWidth: 2 }]} />
            <View style={[styles.ring, { width: 44, height: 44, backgroundColor: colors.accentSoft, borderColor: colors.accent }]} />
            <View style={styles.core} />
          </View>

          <Text style={styles.portrait}>{latest.portrait}</Text>

          {traits.length > 0 && (
            <View style={styles.traits}>
              {traits.map(([name, value]) => (
                <View key={name} style={styles.traitRow}>
                  <Text style={styles.traitName}>{name.replace(/_/g, ' ')}</Text>
                  <View style={styles.traitTrack}>
                    <View style={[styles.traitFill, { width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {latest.deltas?.note && (
            <View style={styles.delta}>
              <Text style={styles.deltaTag}>A shift Bingent noticed</Text>
              <Text style={styles.deltaText}>{latest.deltas.note}</Text>
            </View>
          )}

          <Pressable style={styles.refresh} onPress={compose} disabled={generating}>
            <Ionicons name="refresh-outline" size={15} color={colors.muted} />
            <Text style={styles.refreshText}>{generating ? 'Composing…' : 'Refresh portrait'}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '500' },
  h1: { fontFamily: serif, fontSize: 25, color: colors.ink, marginTop: 3, marginBottom: 8 },
  error: { color: colors.accent, fontSize: 12.5, marginTop: 16 },
  empty: { alignItems: 'center', marginTop: 40, gap: 14 },
  emptyText: { fontFamily: serif, fontSize: 15, lineHeight: 23, color: colors.muted, textAlign: 'center' },
  cta: { backgroundColor: colors.indigo, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, marginTop: 8 },
  ctaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  bloom: { height: 130, alignItems: 'center', justifyContent: 'center', marginVertical: 18 },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  core: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent },
  portrait: { fontFamily: serif, fontSize: 17, lineHeight: 27, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  traits: { marginTop: 18, gap: 10 },
  traitRow: { gap: 5 },
  traitName: { fontSize: 12, color: colors.muted, textTransform: 'capitalize' },
  traitTrack: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  traitFill: { height: 6, borderRadius: 3, backgroundColor: colors.indigo },
  delta: { backgroundColor: colors.indigoSoft, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginTop: 20 },
  deltaTag: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500', color: colors.indigo, marginBottom: 4 },
  deltaText: { fontFamily: serif, fontSize: 14.5, lineHeight: 22, color: colors.ink },
  refresh: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  refreshText: { fontSize: 12.5, color: colors.muted },
});
