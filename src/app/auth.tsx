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

export default function Auth() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const u = username.trim();
    if (!u || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = mode === 'signup'
        ? await api.signup({ username: u, password, display_name: displayName.trim() || undefined })
        : await api.signin({ username: u, password });
      prefs.set({ name: r.display_name, avatarUrl: r.avatar_url ?? '' });
      router.replace('/' as Href); // gate routes onward (onboarding or tabs)
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30 }]}>
        <Text style={styles.brand}>Bingent</Text>
        <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={styles.sub}>
          {isSignup ? 'Just a username and password — nothing else.' : 'Sign in to continue your practice.'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        {isSignup && (
          <TextInput
            style={styles.input}
            placeholder="Display name (optional)"
            placeholderTextColor={colors.muted}
            value={displayName}
            onChangeText={setDisplayName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.cta, (busy || !username.trim() || !password) && { opacity: 0.4 }]} onPress={submit} disabled={busy || !username.trim() || !password}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>{isSignup ? 'Create account' : 'Sign in'}</Text>}
        </Pressable>

        <Pressable
          onPress={() => (isSignup ? setMode('signin') : router.replace('/onboarding' as Href))}
          style={{ marginTop: 18 }}>
          <Text style={styles.toggle}>
            {isSignup ? 'Already have an account? ' : 'New to Bingent? '}
            <Text style={{ color: colors.indigo, fontWeight: '600' }}>{isSignup ? 'Sign in' : 'Create one'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 28 },
  brand: { fontFamily: serif, fontSize: 22, color: colors.ink, textAlign: 'center' },
  title: { fontFamily: serif, fontSize: 26, color: colors.ink, textAlign: 'center', marginTop: 24 },
  sub: { fontSize: 13.5, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 12,
  },
  error: { color: colors.accent, fontSize: 13, marginBottom: 8, textAlign: 'center' },
  cta: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  toggle: { fontSize: 13.5, color: colors.muted, textAlign: 'center' },
});
