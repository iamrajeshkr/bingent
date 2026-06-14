import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, signOut, type Garden, type MirrorSnapshot } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';
import type { Lang } from '@/lib/types';

const RHYTHM_LABEL = { morning: 'Morning pages', commute: 'Commute', winddown: 'Wind-down' };
const MODE_LABEL = { read: 'Read', listen: 'Listen' };

export default function You() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();

  const [garden, setGarden] = useState<Garden | null>(null);
  const [mirror, setMirror] = useState<MirrorSnapshot | null>(null);

  useEffect(() => {
    api.getGarden().then(setGarden).catch(() => {});
    api.getMirror().then(({ latest }) => setMirror(latest)).catch(() => {});
  }, []);

  // Build a fixed-size grid of leaves; kept practices light up.
  const leaves = garden?.leaves ?? [];
  const cells = Array.from({ length: 18 }, (_, i) => leaves[i]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}>
      <Text style={styles.h1}>You</Text>

      {/* The Mirror */}
      <Pressable style={styles.mirror} onPress={() => router.push('/mirror' as Href)}>
        <View style={styles.mirrorBloom}>
          <View style={[styles.ring, { width: 40, height: 40, borderColor: colors.indigo }]} />
          <View style={styles.ringCore} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.mirrorTag}>Your portrait</Text>
          <Text style={styles.mirrorText} numberOfLines={2}>
            {mirror ? mirror.portrait : 'See who you’re becoming — compose your portrait.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {/* The Garden */}
      <Text style={styles.section}>Your garden</Text>
      <View style={styles.gardenCard}>
        <View style={styles.leaves}>
          {cells.map((leaf, i) => (
            <View
              key={i}
              style={[
                styles.leaf,
                {
                  backgroundColor: leaf
                    ? leaf.kept > 0
                      ? colors.accent
                      : colors.accentSoft
                    : colors.cardAlt,
                },
              ]}>
              {leaf && <Ionicons name="leaf" size={11} color={leaf.kept > 0 ? '#FFFFFF' : colors.accent} />}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.statsRow}>
        <Stat n={garden?.practices_kept ?? 0} label="practices kept" />
        <Stat n={garden?.pages_read ?? 0} label="pages read" />
        <Stat n={garden?.days_used ?? prefs.daysUsed.length} label="days with Kitab" />
      </View>

      {/* The Letter */}
      <Pressable style={styles.letter} onPress={() => router.push('/letter' as Href)}>
        <Ionicons name="mail-outline" size={18} color={colors.accent} />
        <Text style={styles.letterText}>A letter from Kitab</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <Pressable style={styles.letter} onPress={() => router.push('/arcs' as Href)}>
        <Ionicons name="trail-sign-outline" size={18} color={colors.indigo} />
        <Text style={styles.letterText}>Becoming arcs</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <Pressable style={styles.letter} onPress={() => router.push('/commonplace' as Href)}>
        <Ionicons name="bookmarks-outline" size={18} color={colors.indigo} />
        <Text style={styles.letterText}>Your commonplace book</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {!!prefs.intent && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>YOUR INTENT</Text>
          <Text style={styles.intent}>"{prefs.intent}"</Text>
        </View>
      )}

      <Text style={styles.section}>Preferences</Text>

      <Toggle label="LANGUAGE" options={(['en', 'hi'] as Lang[]).map((l) => ({ key: l, label: l === 'en' ? 'English' : 'हिंदी' }))}
        value={prefs.language} onChange={(l) => prefs.set({ language: l as Lang })} />
      <Toggle label="DEFAULT MODE" options={(['read', 'listen'] as const).map((m) => ({ key: m, label: MODE_LABEL[m] }))}
        value={prefs.mode} onChange={(m) => prefs.set({ mode: m as 'read' | 'listen' })} />
      <Toggle label="DAILY RHYTHM" options={(['morning', 'commute', 'winddown'] as const).map((r) => ({ key: r, label: RHYTHM_LABEL[r] }))}
        value={prefs.rhythm} onChange={(r) => prefs.set({ rhythm: r as 'morning' | 'commute' | 'winddown' })} />

      <Pressable style={styles.redo} onPress={() => { prefs.set({ onboarded: false }); router.replace('/onboarding'); }}>
        <Ionicons name="refresh-outline" size={15} color={colors.muted} />
        <Text style={styles.redoText}>Redo onboarding</Text>
      </Pressable>
      <Pressable style={styles.redo} onPress={async () => { await signOut(); router.replace('/auth' as Href); }}>
        <Ionicons name="log-out-outline" size={15} color={colors.accent} />
        <Text style={[styles.redoText, { color: colors.accent }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Toggle<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.toggleRow}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <Pressable key={o.key} onPress={() => onChange(o.key)}
              style={[styles.toggle, active ? styles.toggleActive : styles.toggleIdle]}>
              <Text style={[styles.toggleText, active && { color: colors.inkInverse }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 25, color: colors.ink, marginBottom: 14 },
  mirror: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.ink, borderRadius: 16, padding: 16, marginBottom: 18,
  },
  mirrorBloom: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1.5 },
  ringCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent },
  mirrorTag: { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500', color: colors.mutedOnDark },
  mirrorText: { fontFamily: serif, fontSize: 14, lineHeight: 20, color: colors.inkInverse, marginTop: 3 },
  section: { fontFamily: serif, fontSize: 16, color: colors.ink, marginTop: 4, marginBottom: 10 },
  gardenCard: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16, padding: 16,
  },
  leaves: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  leaf: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 18 },
  stat: {
    flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14, paddingVertical: 12, alignItems: 'center',
  },
  statNum: { fontFamily: serif, fontSize: 22, color: colors.ink },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 2 },
  letter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.cardAlt, borderRadius: 14, padding: 14, marginBottom: 18,
  },
  letterText: { flex: 1, fontFamily: serif, fontSize: 15, color: colors.ink },
  card: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  cardLabel: { fontSize: 10.5, letterSpacing: 1.2, color: colors.muted, fontWeight: '500', marginBottom: 8 },
  intent: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, color: colors.ink },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggle: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  toggleActive: { backgroundColor: colors.ink },
  toggleIdle: { backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggleText: { fontSize: 12.5, color: colors.ink },
  redo: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  redoText: { fontSize: 12.5, color: colors.muted },
  note: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 4 },
});
