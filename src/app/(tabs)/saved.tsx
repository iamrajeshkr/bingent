import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/book-cover';
import { PressScale } from '@/components/press';
import { Skeleton } from '@/components/skeleton';
import { SwipeRow } from '@/components/swipe-row';
import { api, type CatalogRef, type HighlightItem, type SavedSummary } from '@/lib/api';
import { colors, serif } from '@/lib/theme';

export default function Saved() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<SavedSummary | null>(null);
  const [lines, setLines] = useState<HighlightItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAllColl, setShowAllColl] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(() => {
    api.getSaved().then(setData).catch(() => {}).finally(() => setLoaded(true));
    api.getHighlights().then((r) => setLines(r.items)).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    try { await api.createPlaylist(n); setName(''); setCreating(false); load(); } catch { /* */ }
  };
  const openItem = (it: CatalogRef) => router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } });
  const removeRecent = async (it: CatalogRef) => {
    setData((d) => (d ? { ...d, recent: d.recent.filter((x) => !(x.kind === it.kind && x.id === it.id)) } : d));
    try { await api.removeSaved(it.kind, it.id); load(); } catch { /* */ }
  };

  const collections = data?.collections ?? [];
  const recent = data?.recent ?? [];

  const CollCard = ({ c }: { c: SavedSummary['collections'][number] }) => (
    <PressScale style={styles.collCard} onPress={() => router.push(`/collection/${c.id}` as Href)} scaleTo={0.95}>
      <View style={styles.collCovers}>
        {c.covers.length === 0
          ? <View style={styles.collEmpty}><Ionicons name="bookmarks-outline" size={18} color={colors.accent} /></View>
          : c.covers.slice(0, 3).map((cv) => <BookCover key={`${cv.kind}-${cv.id}`} item={{ type: cv.kind, title: cv.title, cover: cv.cover }} w={40} r={5} />)}
      </View>
      <Text style={styles.collName} numberOfLines={1}>{c.name}</Text>
      <Text style={styles.collCount}>{c.count} saved</Text>
    </PressScale>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 110 }}>
        <Text style={styles.h1}>Saved</Text>
        <Text style={styles.lede}>The things you set aside to return to.</Text>

        {/* collections */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Your collections</Text>
          {collections.length > 2 && (
            <Pressable onPress={() => setShowAllColl((v) => !v)} hitSlop={8} style={styles.seeAll}>
              <Text style={styles.seeAllText}>{showAllColl ? 'Less' : 'See all'}</Text>
              <Ionicons name={showAllColl ? 'chevron-up' : 'chevron-forward'} size={14} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {!loaded ? (
          <View style={{ flexDirection: 'row', gap: 12 }}><Skeleton width={150} height={120} radius={16} /><Skeleton width={150} height={120} radius={16} /></View>
        ) : showAllColl ? (
          <View style={styles.collGrid}>
            {collections.map((c) => <CollCard key={c.id} c={c} />)}
            <PressScale style={[styles.collCard, styles.quotesCard]} onPress={() => router.push('/commonplace' as Href)} scaleTo={0.95}>
              <View style={styles.collCovers}><View style={styles.collEmpty}><Ionicons name="text-outline" size={18} color={colors.indigo} /></View></View>
              <Text style={styles.collName} numberOfLines={1}>Quotes I kept</Text>
              <Text style={styles.collCount}>{data?.highlights_count ?? 0} lines</Text>
            </PressScale>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
            {collections.map((c) => <CollCard key={c.id} c={c} />)}
            <PressScale style={[styles.collCard, styles.quotesCard]} onPress={() => router.push('/commonplace' as Href)} scaleTo={0.95}>
              <View style={styles.collCovers}><View style={styles.collEmpty}><Ionicons name="text-outline" size={18} color={colors.indigo} /></View></View>
              <Text style={styles.collName} numberOfLines={1}>Quotes I kept</Text>
              <Text style={styles.collCount}>{data?.highlights_count ?? 0} lines</Text>
            </PressScale>
          </ScrollView>
        )}

        {/* lines you kept — one slidable row of quote chips */}
        {lines.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Lines you kept</Text>
              <Pressable onPress={() => router.push('/commonplace' as Href)} hitSlop={8} style={styles.seeAll}>
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
              {lines.slice(0, 10).map((l) => (
                <PressScale key={l.id} style={styles.quoteCard} onPress={() => router.push('/commonplace' as Href)} scaleTo={0.95}>
                  <Text style={styles.quoteMark}>“</Text>
                  <Text style={styles.quote} numberOfLines={4}>{l.quote}</Text>
                  <Text style={styles.quoteFrom} numberOfLines={1}>{l.title}</Text>
                </PressScale>
              ))}
            </ScrollView>
          </>
        )}

        {/* recently saved — bordered, swipe-left to remove everywhere */}
        {recent.length > 0 && (
          <>
            <Text style={[styles.section, { marginTop: 24, marginBottom: 12 }]}>Recently saved</Text>
            {recent.map((it) => (
              <SwipeRow key={`${it.kind}-${it.id}`} height={72} onPress={() => openItem(it)} onDelete={() => removeRecent(it)}>
                <View style={styles.recentRow}>
                  <BookCover item={{ type: it.kind, title: it.title, author: it.author, cover: it.cover }} w={44} r={6} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.recentTitle} numberOfLines={2}>{it.title}</Text>
                    {!!it.author && <Text style={styles.recentMeta} numberOfLines={1}>{it.author}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </View>
              </SwipeRow>
            ))}
            <Text style={styles.swipeHint}>Swipe left to remove — also clears it from your collections</Text>
          </>
        )}

        {loaded && collections.length === 0 && lines.length === 0 && recent.length === 0 && (
          <Text style={styles.empty}>Nothing saved yet. Bookmark a read or underline a line to start a collection.</Text>
        )}
      </ScrollView>

      {/* ergonomic right-thumb "new collection" capsule */}
      <PressScale style={[styles.fab, { bottom: insets.bottom + 18 }]} onPress={() => setCreating(true)} scaleTo={0.9} haptic>
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <Text style={styles.fabText}>New</Text>
      </PressScale>

      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreating(false)} />
        <View style={[styles.createSheet, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.createTitle}>New collection</Text>
          <View style={styles.createRow}>
            <TextInput value={name} onChangeText={setName} placeholder="Collection name" placeholderTextColor={colors.muted}
              style={styles.input} autoFocus maxLength={60} returnKeyType="done" onSubmitEditing={create} />
            <Pressable onPress={create} style={styles.createBtn}><Text style={styles.createBtnText}>Create</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 26, color: colors.ink },
  lede: { fontSize: 13, color: colors.muted, fontStyle: 'italic', fontFamily: serif, marginTop: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  section: { fontFamily: serif, fontSize: 16, color: colors.ink },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 12, color: colors.muted },
  collGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  collCard: { width: 150, backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, gap: 8 },
  quotesCard: { backgroundColor: colors.indigoSoft },
  collCovers: { flexDirection: 'row', gap: 5, height: 60, alignItems: 'center' },
  collEmpty: { width: 40, height: 56, borderRadius: 6, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  collName: { fontFamily: serif, fontSize: 15, color: colors.ink },
  collCount: { fontSize: 11.5, color: colors.muted },
  quoteCard: { width: 230, backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 12, padding: 14 },
  quoteMark: { fontFamily: serif, fontSize: 22, color: colors.accent, opacity: 0.5, lineHeight: 22 },
  quote: { fontFamily: serif, fontSize: 14, lineHeight: 20, color: colors.ink, fontStyle: 'italic', marginTop: 4 },
  quoteFrom: { fontSize: 11, color: colors.muted, marginTop: 8, letterSpacing: 0.3 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 9, marginBottom: 10 },
  recentTitle: { fontFamily: serif, fontSize: 14.5, color: colors.ink, lineHeight: 19 },
  recentMeta: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  swipeHint: { fontSize: 11.5, color: colors.muted, fontStyle: 'italic', fontFamily: serif, textAlign: 'center', marginTop: 4 },
  empty: { color: colors.muted, fontStyle: 'italic', fontFamily: serif, fontSize: 13.5, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  fab: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  fabText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,15,10,0.4)' },
  createSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  createTitle: { fontFamily: serif, fontSize: 18, color: colors.ink, marginBottom: 12 },
  createRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  createBtn: { backgroundColor: colors.indigo, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 13.5 },
});
