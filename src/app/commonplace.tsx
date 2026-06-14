import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type HighlightItem } from '@/lib/api';
import { colors, serif, typeColors } from '@/lib/theme';

// The commonplace book — every line you've underlined, newest first.
export default function Commonplace() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<HighlightItem[] | null>(null);

  useEffect(() => {
    api.getHighlights().then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: 40 }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: 12 }}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.kicker}>Your commonplace book</Text>
      <Text style={styles.h1}>Lines you've kept</Text>

      {items === null && <ActivityIndicator color={colors.indigo} style={{ marginTop: 40 }} />}
      {items?.length === 0 && (
        <Text style={styles.empty}>
          Nothing kept yet. While reading, long-press a line and tap “Underline & keep” — it lands here.
        </Text>
      )}

      {items?.map((h) => (
        <Pressable
          key={h.id}
          style={styles.card}
          onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: h.item_kind, id: h.item_id } })}>
          <Text style={styles.quote}>"{h.quote}"</Text>
          {!!h.note && <Text style={styles.note}>— {h.note}</Text>}
          <Text style={[styles.source, { color: typeColors[h.item_kind] }]} numberOfLines={1}>
            {h.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontWeight: '500' },
  h1: { fontFamily: serif, fontSize: 25, color: colors.ink, marginTop: 3, marginBottom: 18 },
  empty: { fontFamily: serif, fontSize: 15, lineHeight: 23, color: colors.muted, marginTop: 30, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 15, marginBottom: 10 },
  quote: { fontFamily: serif, fontSize: 16, lineHeight: 24, color: colors.ink },
  note: { fontFamily: serif, fontStyle: 'italic', fontSize: 13, color: colors.muted, marginTop: 8 },
  source: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '500', marginTop: 10 },
});
