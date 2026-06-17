import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
import { Appear } from '@/components/appear';
import { BookCover } from '@/components/book-cover';
import { api, type AskTurn, type CatalogRef } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif, typeColors } from '@/lib/theme';

interface Turn extends AskTurn {
  items?: CatalogRef[];
}

const TYPE_LABEL: Record<string, string> = { byte: 'Byte', journey: 'Journey', summary: 'Summary' };

export default function Ask() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    const query = input.trim();
    if (!query || busy) return;
    setInput('');
    setTurns((t) => [...t, { role: 'user', text: query }]);
    setBusy(true);
    try {
      const history: AskTurn[] = turns.map((t) => ({ role: t.role, text: t.text }));
      const { reply, items } = await api.ask({ query, lang: prefs.language, history });
      setTurns((t) => [...t, { role: 'model', text: reply, items }]);
    } catch (e: any) {
      setTurns((t) => [...t, { role: 'model', text: `Something went wrong — ${e?.message ?? e}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 49 : 0}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={15} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.h1}>Ask Bingent</Text>
          <Text style={styles.sub}>Remembers what moves you</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {turns.length === 0 && (
          <Text style={styles.empty}>
            Tell Bingent how you feel, or what you want to become — it will draw a path from the
            library for you.{'\n\n'}Try: "I feel restless all the time"
          </Text>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <View key={i} style={styles.userBubble}>
              <Text style={styles.userText}>{t.text}</Text>
            </View>
          ) : (
            <Appear key={i}>
              <Text style={styles.reply}>{t.text}</Text>
              {t.items?.map((item) => (
                <Pressable
                  key={`${item.kind}-${item.id}`}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: item.kind, id: item.id } })}>
                  <BookCover item={{ type: item.kind, title: item.title, author: item.author, cover: item.cover }} w={44} r={6} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTag, { color: typeColors[item.kind] }]}>{TYPE_LABEL[item.kind]}</Text>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {!!item.author && <Text style={styles.cardMeta} numberOfLines={1}>{item.author}</Text>}
                  </View>
                </Pressable>
              ))}
            </Appear>
          )
        )}
        {busy && <ActivityIndicator color={colors.indigo} style={{ marginVertical: 12 }} />}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Tell Bingent how tonight feels…"
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={styles.sendBtn} onPress={send} disabled={busy || !input.trim()}>
          <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.indigo, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: serif, fontSize: 19, color: colors.ink },
  sub: { fontSize: 11, color: colors.muted },
  empty: { fontFamily: serif, fontStyle: 'italic', fontSize: 14.5, lineHeight: 22, color: colors.muted, marginTop: 28, textAlign: 'center' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.ink, borderRadius: 14, borderTopRightRadius: 4, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 10, maxWidth: '80%' },
  userText: { color: colors.inkInverse, fontSize: 13.5 },
  reply: { fontFamily: serif, fontSize: 15, lineHeight: 23, color: colors.ink, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center' },
  cover: { width: 44, height: 58, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTag: { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500' },
  cardTitle: { fontFamily: serif, fontSize: 15, color: colors.ink, marginTop: 2 },
  cardMeta: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, fontSize: 13.5, color: colors.ink },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.indigo, alignItems: 'center', justifyContent: 'center' },
});
