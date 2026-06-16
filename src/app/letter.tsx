import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Letter } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';

// A letter from Bingent — the week, narrated back to the reader.
export default function LetterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();

  const [letter, setLetter] = useState<Letter | null>(null);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLetter()
      .then(({ letter }) => setLetter(letter))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const write = async () => {
    setWriting(true);
    setError(null);
    try {
      setLetter(await api.generateLetter(prefs.language));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setWriting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: 40 }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 14 }}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>

      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Ionicons name="mail-open-outline" size={26} color={colors.accent} />
        <Text style={styles.h1}>A letter from Bingent</Text>
      </View>

      {loading && <ActivityIndicator color={colors.indigo} style={{ marginTop: 30 }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && letter && (
        <>
          {letter.body.split(/\n{2,}/).map((para, i) => (
            <Text key={i} style={styles.para}>
              {para.trim()}
            </Text>
          ))}
          <Pressable style={styles.refresh} onPress={write} disabled={writing}>
            <Ionicons name="refresh-outline" size={15} color={colors.muted} />
            <Text style={styles.refreshText}>{writing ? 'Writing…' : 'Write a fresh letter'}</Text>
          </Pressable>
        </>
      )}

      {!loading && !letter && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No letter yet. When you've spent a little time with Bingent, it can write you one — your
            week, narrated back.
          </Text>
          <Pressable style={styles.cta} onPress={write} disabled={writing}>
            {writing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Write this week's letter</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 21, color: colors.ink, marginTop: 6 },
  error: { color: colors.accent, fontSize: 12.5, marginTop: 16 },
  para: { fontFamily: serif, fontSize: 16, lineHeight: 27, color: colors.ink, marginBottom: 14 },
  empty: { alignItems: 'center', marginTop: 30, gap: 16 },
  emptyText: { fontFamily: serif, fontSize: 15, lineHeight: 23, color: colors.muted, textAlign: 'center' },
  cta: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 24 },
  ctaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  refresh: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  refreshText: { fontSize: 12.5, color: colors.muted },
});
