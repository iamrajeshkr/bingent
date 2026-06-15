import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResumeRibbon } from '@/components/resume';
import { Skeleton } from '@/components/skeleton';
import { api, type ContinueItem } from '@/lib/api';
import { usePlayer } from '@/lib/player';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';

// Full list of in-progress items — navigated to from the "Pick up where you
// paused" chevron on the Shelf tab.
export default function ContinueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const player = usePlayer();

  const [items, setItems] = useState<ContinueItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.getContinue()
        .then((r) => setItems(r.items.filter((i) => !i.position?.completed)))
        .catch(() => {})
        .finally(() => setLoaded(true));
    }, [])
  );

  const openItem = (it: ContinueItem) =>
    router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } });

  const resume = (it: ContinueItem) =>
    player.playItem(it.kind, it.id, {
      lang: prefs.language,
      ...(it.kind !== 'journey' ? { startAtSec: it.position?.audioSec ?? 0 } : {}),
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Pick up where you paused</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 40, gap: 12 }}>
        {!loaded && (
          <>
            <Skeleton height={80} radius={16} />
            <Skeleton height={80} radius={16} />
            <Skeleton height={80} radius={16} />
          </>
        )}

        {loaded && items.length === 0 && (
          <Text style={styles.empty}>Nothing in progress right now. Start reading something!</Text>
        )}

        {items.map((it) => (
          <ResumeRibbon
            key={`${it.kind}-${it.id}`}
            it={it}
            onOpen={() => openItem(it)}
            onPlay={() => resume(it)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  title: { fontFamily: serif, fontSize: 17, color: colors.ink, textAlign: 'center', flex: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontFamily: serif, fontStyle: 'italic', fontSize: 14 },
});
