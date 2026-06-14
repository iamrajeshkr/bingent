import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Resonance } from '@/lib/api';
import { colors, serif } from '@/lib/theme';
import type { ItemType, Lang } from '@/lib/types';

// Bottom sheet for "ask this line" — answers in the author's voice, grounded in
// the passage. Rendered as an in-flow absolute overlay (no position:fixed).
export function AskLineSheet({
  kind,
  id,
  lang,
  quote,
  onClose,
}: {
  kind: ItemType;
  id: string;
  lang: Lang;
  quote: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [answer, setAnswer] = useState<string | null>(null);
  const [grounded, setGrounded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [resonance, setResonance] = useState<Resonance | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setAnswer(null);
    setSaved(false);
    setResonance(null);
    api.getResonance({ kind, id, quote }).then((r) => alive && setResonance(r)).catch(() => {});
    api
      .askLine({ kind, id, lang, quote, question: 'What does this mean for me tonight?' })
      .then((r) => {
        if (!alive) return;
        setAnswer(r.answer);
        setGrounded(r.grounded);
      })
      .catch((e) => alive && setAnswer(String(e?.message ?? e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [quote, kind, id, lang]);

  const underline = async () => {
    setSaved(true); // optimistic
    try {
      await api.saveHighlight({ kind, id, lang, quote });
    } catch {
      setSaved(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.tag}>
          <Ionicons name="chatbubble-ellipses-outline" size={11} /> In the author's voice
        </Text>
        <Text style={styles.quote} numberOfLines={3}>
          "{quote}"
        </Text>

        {resonance && resonance.count > 0 && (
          <View style={styles.resonance}>
            <Text style={styles.resonanceCount}>
              <Ionicons name="people-outline" size={12} /> {resonance.count} {resonance.count === 1 ? 'reader' : 'readers'} underlined this
            </Text>
            {resonance.samples.filter((s) => s.note).slice(0, 1).map((s, i) => (
              <Text key={i} style={styles.resonanceNote}>"{s.note}"</Text>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.indigo} style={{ marginVertical: 18 }} />
        ) : (
          <Text style={styles.answer}>{answer}</Text>
        )}
        {!loading && grounded && (
          <Text style={styles.note}>
            <Ionicons name="link" size={10} /> grounded in this page
          </Text>
        )}
        <Pressable style={[styles.underline, saved && { backgroundColor: colors.cardAlt }]} onPress={underline} disabled={saved}>
          <Ionicons name={saved ? 'checkmark' : 'bookmark-outline'} size={15} color={saved ? colors.muted : '#FFFFFF'} />
          <Text style={[styles.underlineText, saved && { color: colors.muted }]}>{saved ? 'Saved to your shelf' : 'Underline & keep'}</Text>
        </Pressable>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(38,32,58,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.track, marginBottom: 14 },
  tag: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500', color: colors.indigo, marginBottom: 6 },
  quote: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, lineHeight: 22, color: colors.ink, marginBottom: 8 },
  answer: { fontFamily: serif, fontSize: 15, lineHeight: 24, color: colors.ink, marginTop: 6 },
  note: { fontSize: 11, color: colors.muted, marginTop: 10 },
  resonance: { backgroundColor: colors.indigoSoft, borderRadius: 12, padding: 11, marginTop: 4 },
  resonanceCount: { fontSize: 12, color: colors.indigo, fontWeight: '500' },
  resonanceNote: { fontFamily: serif, fontStyle: 'italic', fontSize: 12.5, color: colors.ink, marginTop: 4 },
  underline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 12, marginTop: 14 },
  underlineText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '500' },
  close: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
  closeText: { fontSize: 13, color: colors.muted },
});
