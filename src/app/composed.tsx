import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ComposedPage, type ReflectionResult } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';
import type { Weather } from '@/lib/weather';

// "Tonight's page" — an original, grounded page composed by the backend for the
// reader's weather, closing with the Practice Loop's "one line back" reflection.
export default function ComposedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const { weather, intent } = useLocalSearchParams<{ weather: Weather; intent?: string }>();

  const [page, setPage] = useState<ComposedPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ReflectionResult | null>(null);

  useEffect(() => {
    let alive = true;
    setPage(null);
    setError(null);
    api
      .composePage({ weather, intent: intent || undefined, lang: prefs.language })
      .then((p) => alive && setPage(p))
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [weather, intent, prefs.language]);

  const saveReflection = async () => {
    const text = reflection.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const r = await api.reflect({ text, lang: prefs.language, context: { weather } });
      setResult(r);
      setReflection('');
    } catch {
      // keep the text so the user doesn't lose it
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 14 }}>
            <Ionicons name="chevron-back" size={22} color={colors.inkInverse} />
          </Pressable>
          <Text style={styles.heroTag}>
            <Ionicons name="sparkles" size={11} /> Composed for you · {weather}
          </Text>
          {page && <Text style={styles.heroTitle}>{page.title}</Text>}
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 18 }}>
          {!page && !error && <ActivityIndicator color={colors.indigo} style={{ marginTop: 30 }} />}
          {error && <Text style={styles.error}>Bingent couldn't write your page — {error}</Text>}

          {page?.paragraphs.map((p, i) => (
            <Text key={i} style={styles.para}>
              {p}
            </Text>
          ))}

          {page && page.sources.length > 0 && (
            <View style={styles.sources}>
              <Ionicons name="book-outline" size={13} color={colors.muted} />
              <Text style={styles.sourcesText}>
                Drawn from {page.sources.length} passage{page.sources.length > 1 ? 's' : ''} in your library
              </Text>
            </View>
          )}

          {page && (
            <>
              <View style={styles.divider} />
              <Text style={styles.loopHeader}>One line back</Text>
              {result ? (
                <View style={styles.saved}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.indigo} />
                  <Text style={styles.savedText}>Kept. Bingent will remember this.</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="What surfaced for you? (stays private)"
                    placeholderTextColor={colors.muted}
                    value={reflection}
                    onChangeText={setReflection}
                    multiline
                  />
                  <Pressable
                    style={[styles.keepBtn, (!reflection.trim() || saving) && { opacity: 0.4 }]}
                    onPress={saveReflection}
                    disabled={!reflection.trim() || saving}>
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.keepText}>Keep this reflection</Text>
                    )}
                  </Pressable>
                </>
              )}

              {/* The companion knows when to step back. */}
              {result?.safety.resources && (
                <View style={styles.care}>
                  <Text style={styles.careMsg}>{result.safety.resources.message}</Text>
                  {result.safety.resources.lines.map((l) => (
                    <Text key={l.name} style={styles.careLine}>
                      {l.name} · {l.contact}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  heroTag: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500', color: colors.accent },
  heroTitle: { fontFamily: serif, fontSize: 24, lineHeight: 31, color: colors.inkInverse, marginTop: 8 },
  para: { fontFamily: serif, fontSize: 16, lineHeight: 26, color: colors.ink, marginBottom: 16 },
  error: { color: colors.accent, fontSize: 13, marginTop: 20 },
  sources: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  sourcesText: { fontSize: 11.5, color: colors.muted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 24 },
  loopHeader: { fontFamily: serif, fontSize: 18, color: colors.ink, marginBottom: 10 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    minHeight: 64,
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  keepBtn: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  keepText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '500' },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  savedText: { fontFamily: serif, fontSize: 14.5, color: colors.ink },
  care: {
    backgroundColor: colors.indigoSoft,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  careMsg: { fontSize: 13, lineHeight: 20, color: colors.ink, marginBottom: 8 },
  careLine: { fontSize: 12.5, color: colors.indigo, marginTop: 2, fontWeight: '500' },
});
