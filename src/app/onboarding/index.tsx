import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
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
import { api } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';
import type { Lang } from '@/lib/types';
import { WEATHERS, type Weather } from '@/lib/weather';

type Step = 'welcome' | 'ask' | 'account';
const INTENT_CHIPS = ['a calmer mind', 'better focus', 'deeper sleep', 'less anxious'];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();

  const [step, setStep] = useState<Step>('welcome');
  const [lang, setLang] = useState<Lang>('en');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [intent, setIntent] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = async () => {
    const u = username.trim();
    if (!u || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.signup({ username: u, password });
      prefs.set({ language: lang, intent: intent.trim(), onboarded: true });
      router.replace('/' as Href);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <View style={styles.header}>
          <Text style={styles.brand}>Bingent</Text>
          <View style={styles.langRow}>
            {(['en', 'hi'] as Lang[]).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.langPill, lang === l && styles.langActive]}>
                <Text style={[styles.langText, lang === l && { color: colors.inkInverse }]}>{l === 'en' ? 'EN' : 'हि'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {step === 'welcome' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.title}>A quiet place to{'\n'}read yourself back to calm.</Text>
            <Text style={styles.welcomeBody}>
              No feed, no streak to chase — just a page a day, shaped to how you actually feel.
            </Text>
            <Pressable style={styles.cta} onPress={() => setStep('ask')}>
              <Text style={styles.ctaText}>Begin</Text>
            </Pressable>
          </View>
        )}

        {step === 'ask' && (
          <>
            <Text style={styles.title}>How is it inside,{'\n'}right now?</Text>
            <View style={styles.weatherRow}>
              {WEATHERS.map((w) => {
                const active = weather === w.key;
                return (
                  <Pressable key={w.key} onPress={() => setWeather(active ? null : w.key)} style={[styles.wq, active && { borderColor: w.tint, borderWidth: 1.5, backgroundColor: colors.indigoSoft }]}>
                    <Ionicons name={w.icon} size={18} color={active ? w.tint : colors.muted} />
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.q}>What do you want to become, or what's stirring?</Text>
            <View style={styles.chipRow}>
              {INTENT_CHIPS.map((c) => (
                <Pressable key={c} style={[styles.chip, intent === c && styles.chipActive]} onPress={() => setIntent(c)}>
                  <Text style={[styles.chipText, intent === c && { color: colors.inkInverse }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="…or in your own words (optional)" placeholderTextColor={colors.muted} value={intent} onChangeText={setIntent} multiline />
            <Pressable style={styles.cta} onPress={() => setStep('account')}>
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </>
        )}

        {step === 'account' && (
          <>
            <Text style={styles.title}>Make it yours</Text>
            <Text style={styles.sub}>A username & password keeps your shelf and your place — across devices. No email.</Text>
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} onSubmitEditing={createAccount} returnKeyType="go" />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.cta, (busy || !username.trim() || !password) && { opacity: 0.4 }]} onPress={createAccount} disabled={busy || !username.trim() || !password}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Create account & begin</Text>}
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.replace('/auth' as Href)} style={{ marginTop: 18 }}>
          <Text style={styles.signin}>Already have an account? <Text style={{ color: colors.indigo, fontWeight: '600' }}>Sign in</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brand: { fontFamily: serif, fontSize: 22, color: colors.ink },
  langRow: { flexDirection: 'row', gap: 6 },
  langPill: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  langActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  langText: { fontSize: 12, color: colors.ink },
  title: { fontFamily: serif, fontSize: 25, lineHeight: 32, color: colors.ink, marginBottom: 16 },
  welcomeBody: { fontFamily: serif, fontSize: 15.5, lineHeight: 24, color: colors.muted, marginBottom: 26 },
  sub: { fontSize: 13.5, color: colors.muted, marginTop: -8, marginBottom: 16 },
  weatherRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  wq: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  q: { fontFamily: serif, fontSize: 16, color: colors.ink, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontSize: 12.5, color: colors.ink },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, fontSize: 14.5, color: colors.ink, marginBottom: 12, minHeight: 48 },
  error: { color: colors.accent, fontSize: 13, marginBottom: 8 },
  cta: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  ctaText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '500' },
  signin: { fontSize: 13.5, color: colors.muted, textAlign: 'center' },
});
