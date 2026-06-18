import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Appear } from '@/components/appear';
import { BookCover } from '@/components/book-cover';
import { PressScale } from '@/components/press';
import { api } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { WEATHERS, type Weather } from '@/lib/weather';

// Bingent landing palette — warm coral/amber, kept local to the onboarding so
// the brand surface matches the Claude Design spec without touching app theme.
const C = {
  bg: '#FFF6EC', card: '#FFFFFF', cardAlt: '#F3E7D8', border: '#EADBC9',
  ink: '#2A1E16', muted: '#8A6F5C', mutedDark: '#C9B6A4',
  accent: '#FF6A3D', accentSoft: '#FFE3D4', indigo: '#B5602A', indigoSoft: '#FFF1E6', track: '#EADBC9',
  heroBg: '#1F150D', deviceDark: '#241712', amber: '#FFB23E',
};

const INTENTS = ['a calmer mind', 'better focus', 'deeper sleep', 'less anxious', 'more meaning'];

// Direction 03 — Grow/Play: a leaf that doubles as a play button on a coral→amber square.
function BingentMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="bgmark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF6A3D" />
          <Stop offset="1" stopColor="#FFB23E" />
        </LinearGradient>
      </Defs>
      <Rect x="6" y="6" width="108" height="108" rx="30" fill="url(#bgmark)" />
      <Path d="M44,84 C40,58 54,36 88,32 C84,66 70,84 44,84 Z" fill="#fff" />
      <Path d="M50,79 L83,41" fill="none" stroke="rgba(217,80,38,.32)" strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  );
}

function Dots({ active, n = 2 }: { active: number; n?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={{ width: i === active ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === active ? C.accent : C.track }} />
      ))}
    </View>
  );
}

function Cta({ children, onClick, light, disabled }: { children: React.ReactNode; onClick: () => void; light?: boolean; disabled?: boolean }) {
  return (
    <PressScale onPress={onClick} disabled={disabled} scaleTo={0.985}
      style={[styles.cta, { backgroundColor: disabled ? C.track : light ? C.amber : C.accent, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={[styles.ctaText, { color: light ? C.ink : '#fff' }]}>{children}</Text>
    </PressScale>
  );
}

type Step = 'landing' | 'mood' | 'signup' | 'done';

const FAN = [
  { type: 'summary' as const, title: 'The Happiness Trap', author: 'Russ Harris' },
  { type: 'journey' as const, title: 'From Restlessness to Peace', author: 'Bingent' },
  { type: 'byte' as const, title: 'Still The Mind', author: 'Alan Watts' },
];

const ABOUT = [
  { icon: 'layers-outline' as const, t: 'Bytes, Summaries & Journeys', d: 'A big idea in 5 minutes — or a guided path that unfolds over days.' },
  { icon: 'headset-outline' as const, t: 'Read or listen · EN / हिंदी', d: 'Every page exists as both, in two languages. Switch anytime, even mid-page.' },
  { icon: 'pulse-outline' as const, t: 'Shaped to how you feel', d: 'No feed, no streak to chase. One practice a day, tuned to your mood.' },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();

  const [step, setStep] = useState<Step>('landing');
  const [mood, setMood] = useState<Weather | null>(null);
  const [intent, setIntent] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = async () => {
    const u = username.trim();
    if (!u || password.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.signup({ username: u, password });
      // Persist the mood as today's weather so Home doesn't ask again the same
      // day — the picker should surface only once a day (next day onward).
      if (mood) api.setWeather({ weather: mood, local_hour: new Date().getHours() }).catch(() => {});
      prefs.set({
        intent: intent.trim(),
        onboarded: true,
        ...(mood ? { todayWeather: mood, todayWeatherDate: new Date().toISOString().slice(0, 10) } : {}),
      });
      setStep('done');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  // ---- Landing -----------------------------------------------------------
  if (step === 'landing') {
    return (
      <View style={{ flex: 1, backgroundColor: C.heroBg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 8 }} showsVerticalScrollIndicator={false}>
          <Appear>
            {/* dark hero */}
            <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
              <View style={styles.heroGlow} />
              <View style={styles.wordmark}>
                <BingentMark size={28} />
                <Text style={styles.brand}>Bingent</Text>
              </View>
              <View style={styles.fan}>
                {FAN.map((it, i) => (
                  <View key={i} style={[styles.fanCard, {
                    transform: [{ translateX: (i - 1) * 52 }, { rotate: `${(i - 1) * 8}deg` }, { translateY: Math.abs(i - 1) * 14 }],
                    zIndex: i === 1 ? 3 : 1,
                  }]}>
                    <BookCover item={it} w={i === 1 ? 116 : 100} />
                  </View>
                ))}
              </View>
            </View>

            {/* cream body */}
            <View style={styles.landingBody}>
              <Text style={styles.headline}>Read your way{'\n'}into who you want to be.</Text>
              <Text style={styles.lede}>Bingent is a small library for a restless mind — wisdom you can actually finish, narrated by real voices.</Text>
              <View style={{ gap: 16, marginTop: 4 }}>
                {ABOUT.map((a, i) => (
                  <View key={i} style={styles.aboutRow}>
                    <View style={styles.aboutIc}><Ionicons name={a.icon} size={17} color={C.indigo} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aboutT}>{a.t}</Text>
                      <Text style={styles.aboutD}>{a.d}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 24 }}>
                <Cta onClick={() => setStep('mood')}>Begin — it takes a minute</Cta>
                <PressScale onPress={() => router.replace('/auth' as Href)} style={{ paddingVertical: 8, marginTop: 6 }}>
                  <Text style={styles.textlink}>Already have an account? <Text style={{ color: C.accent, fontWeight: '700' }}>Sign in</Text></Text>
                </PressScale>
              </View>
            </View>
          </Appear>
        </ScrollView>
      </View>
    );
  }

  // ---- Mood + intent (Step 1 of 2) --------------------------------------
  if (step === 'mood') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
          <PressScale onPress={() => setStep('landing')} style={styles.iconbtn} scaleTo={0.9}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </PressScale>
          <Dots active={0} />
          <View style={{ width: 34 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
          <Appear>
            <Text style={styles.kick}>Step 1 of 2</Text>
            <Text style={styles.stepTitle}>How is it inside,{'\n'}right now?</Text>
            <Text style={styles.stepSub}>This tunes today's page. Tap what fits — there's no wrong answer.</Text>

            <View style={styles.moodRow}>
              {WEATHERS.map((m) => {
                const on = mood === m.key;
                return (
                  <PressScale key={m.key} onPress={() => setMood(on ? null : m.key)} scaleTo={0.96}
                    style={[styles.mood, { borderColor: on ? m.tint : C.border, backgroundColor: on ? C.indigoSoft : C.card }]}>
                    <Ionicons name={m.icon} size={20} color={on ? m.tint : C.muted} />
                    <Text style={{ fontSize: 10.5, color: on ? C.ink : C.muted, fontWeight: on ? '700' : '500' }}>{m.label}</Text>
                  </PressScale>
                );
              })}
            </View>

            <Text style={styles.stepQ}>What are you reaching for?</Text>
            <View style={styles.chips}>
              {INTENTS.map((c) => {
                const on = intent === c;
                return (
                  <PressScale key={c} onPress={() => setIntent(on ? '' : c)} scaleTo={0.96}
                    style={[styles.chip, { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.border }]}>
                    <Text style={{ fontSize: 13, color: on ? C.bg : C.ink }}>{c}</Text>
                  </PressScale>
                );
              })}
            </View>

            <View style={styles.voicebox}>
              <Text style={styles.voiceText}>…or say it in your own words</Text>
              <View style={styles.mic}><Ionicons name="mic-outline" size={15} color={C.accent} /></View>
            </View>
          </Appear>
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 14 }}>
          <Cta onClick={() => setStep('signup')} disabled={!mood && !intent}>Continue</Cta>
        </View>
      </View>
    );
  }

  // ---- Signup (Step 2 of 2) ---------------------------------------------
  if (step === 'signup') {
    const ok = username.trim() && password.length >= 4;
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
          <PressScale onPress={() => setStep('mood')} style={styles.iconbtn} scaleTo={0.9}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </PressScale>
          <Dots active={1} />
          <View style={{ width: 34 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Appear>
            <Text style={styles.kick}>Step 2 of 2 · last one</Text>
            <Text style={styles.stepTitle}>Make it yours</Text>
            <Text style={styles.stepSub}>A username and password keeps your shelf and your place — across devices. No email, ever.</Text>

            <Text style={styles.fieldL}>Username</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="rajesh" placeholderTextColor={C.mutedDark} autoCapitalize="none" autoCorrect={false} />
            <Text style={[styles.fieldL, { marginTop: 14 }]}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="at least 4 characters" placeholderTextColor={C.mutedDark} secureTextEntry autoCapitalize="none" onSubmitEditing={createAccount} returnKeyType="go" />

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.reassure}>
              <Ionicons name="checkmark-circle" size={15} color="#4FAE68" />
              <Text style={styles.reassureText}>Your reading stays private. We never sell or share it.</Text>
            </View>
          </Appear>
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 14 }}>
          <Cta onClick={createAccount} disabled={!ok || busy}>
            {busy ? <ActivityIndicator color="#fff" /> : 'Create account & begin'}
          </Cta>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ---- Done --------------------------------------------------------------
  return (
    <View style={[styles.doneWrap, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <Appear>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.doneRing}><Ionicons name="checkmark" size={32} color="#fff" /></View>
          <Text style={[styles.stepTitle, { marginTop: 22, textAlign: 'center' }]}>Your shelf is ready</Text>
          <Text style={[styles.stepSub, { maxWidth: 280, textAlign: 'center' }]}>
            We've set today's page for how you're feeling. Open Bingent whenever you have five quiet minutes.
          </Text>
        </View>
      </Appear>
      <View style={{ width: '100%', paddingHorizontal: 24 }}>
        <Cta onClick={() => router.replace('/' as Href)}>Open my shelf</Cta>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // landing
  hero: { paddingHorizontal: 24, paddingBottom: 30, backgroundColor: C.heroBg, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -40, right: -40, width: 260, height: 220, borderRadius: 130, backgroundColor: 'rgba(255,178,62,0.22)' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  brand: { color: '#FFF1E6', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  fan: { height: 230, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  fanCard: { position: 'absolute', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 14 } },
  landingBody: { backgroundColor: C.bg, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 14, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -22 },
  headline: { fontSize: 29, lineHeight: 34, color: C.ink, fontWeight: '700', letterSpacing: -0.4, marginBottom: 12 },
  lede: { fontSize: 14, lineHeight: 22, color: C.muted, marginBottom: 22 },
  aboutRow: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  aboutIc: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  aboutT: { fontSize: 14.5, color: C.ink, fontWeight: '700', marginBottom: 2 },
  aboutD: { fontSize: 12.5, lineHeight: 18, color: C.muted },
  textlink: { textAlign: 'center', fontSize: 13, color: C.muted },

  // shared chrome
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 6 },
  iconbtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cta: { width: '100%', borderRadius: 999, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 14.5, fontWeight: '700', letterSpacing: 0.2 },
  kick: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: C.muted, fontWeight: '700', marginTop: 6 },
  stepTitle: { fontSize: 27, lineHeight: 32, color: C.ink, fontWeight: '700', letterSpacing: -0.4, marginTop: 8, marginBottom: 8 },
  stepSub: { fontSize: 13.5, lineHeight: 20, color: C.muted, marginBottom: 22 },
  stepQ: { fontSize: 15, color: C.ink, fontWeight: '600', marginTop: 22, marginBottom: 11 },

  // mood
  moodRow: { flexDirection: 'row', gap: 9 },
  mood: { flex: 1, borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 2, alignItems: 'center', gap: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  voicebox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingVertical: 8, paddingLeft: 18, paddingRight: 8 },
  voiceText: { fontStyle: 'italic', color: C.muted, fontSize: 13.5 },
  mic: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },

  // signup
  fieldL: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 7, letterSpacing: 0.3 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: C.ink },
  error: { color: C.accent, fontSize: 13, marginTop: 12 },
  reassure: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  reassureText: { fontSize: 12, color: C.muted, flex: 1 },

  // done
  doneWrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'space-between' },
  doneRing: { width: 74, height: 74, borderRadius: 37, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
});
