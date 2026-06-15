import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContentCard } from '@/components/content-card';
import { Skeleton } from '@/components/skeleton';
import { api, type BrowseItem } from '@/lib/api';
import { colors, serif } from '@/lib/theme';
import type { CatalogItem, ItemType } from '@/lib/types';

const FILTERS: { key: 'all' | ItemType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'byte', label: 'Bytes' },
  { key: 'summary', label: 'Summaries' },
  { key: 'journey', label: 'Journeys' },
];
const PAGE = 24;

// Browse rows are lean (no audio/duration); adapt to what ContentCard reads.
const toCard = (b: BrowseItem): CatalogItem =>
  ({ type: b.kind, id: b.id, title: b.title, author: b.author, cover: b.cover, category: b.category, durationLabel: '' } as CatalogItem);

export default function Discover() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | ItemType>('all');
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingMore = useRef(false);

  const load = useCallback(async (kind: 'all' | ItemType, p: number) => {
    if (p === 0) { setLoading(true); setError(null); } else { loadingMore.current = true; }
    try {
      const r = await api.getBrowse(kind, p, PAGE);
      setItems((prev) => (p === 0 ? r.items : [...prev, ...r.items]));
      setPage(p);
      setHasMore(r.hasMore);
    } catch (e: any) {
      if (p === 0) setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, []);

  // Reload from the top whenever the filter changes.
  useEffect(() => { load(filter, 0); }, [filter, load]);

  const onEndReached = () => {
    if (hasMore && !loadingMore.current && !loading) load(filter, page + 1);
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 96 }}
      data={items}
      keyExtractor={(it) => `${it.kind}-${it.id}`}
      renderItem={({ item }) => <ContentCard item={toCard(item)} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      // Perf: virtualization keeps only the visible rows mounted.
      initialNumToRender={10}
      windowSize={9}
      removeClippedSubviews
      ListHeaderComponent={
        <>
          <Text style={styles.h1}>Discover</Text>
          <View style={styles.filters}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.filter, active ? styles.filterActive : styles.filterIdle]}>
                  <Text style={[styles.filterText, active && { color: colors.inkInverse }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {error && <Text style={styles.error}>Couldn't load the library — {error}</Text>}
        </>
      }
      ListEmptyComponent={
        loading ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={92} radius={14} />
            ))}
          </View>
        ) : !error ? (
          <Text style={styles.empty}>Nothing here yet.</Text>
        ) : null
      }
      ListFooterComponent={
        !loading && hasMore && items.length > 0 ? (
          <ActivityIndicator color={colors.muted} style={{ marginVertical: 16 }} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 24, color: colors.ink, marginBottom: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filter: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  filterActive: { backgroundColor: colors.ink },
  filterIdle: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  filterText: { fontSize: 12, color: colors.ink },
  error: { color: colors.accent, fontSize: 12.5, marginVertical: 12 },
  empty: { color: colors.muted, fontSize: 13, marginTop: 24, textAlign: 'center' },
});
