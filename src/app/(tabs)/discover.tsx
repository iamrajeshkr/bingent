import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover } from '@/components/book-cover';
import { PressScale } from '@/components/press';
import { Skeleton } from '@/components/skeleton';
import { api, type CatalogRef, type ThreadGroup } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';

// Discover · Reading Rooms — editorial themed spaces (not a list to scroll),
// built from the enriched /v1/threads (each theme carries a note + colours).
export default function Discover() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();
  const [rooms, setRooms] = useState<ThreadGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.getThreads(prefs.language)
        .then((r) => setRooms(r.threads.filter((t) => t.items.length > 0)))
        .catch(() => {})
        .finally(() => setLoaded(true));
    }, [prefs.language])
  );

  const open = (it: CatalogRef) => router.push({ pathname: '/item/[type]/[id]', params: { type: it.kind, id: it.id } });
  const openRoom = (slug: string) => router.push(`/room/${slug}` as Href);
  const featured = rooms[0];
  const rest = rooms.slice(1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 96 }}>
      <Text style={styles.h1}>Discover</Text>
      <Text style={styles.lede}>Rooms to wander — not a list to scroll.</Text>

      {!loaded && (
        <View style={{ marginTop: 18, gap: 14 }}>
          <Skeleton height={210} radius={22} />
          <Skeleton height={96} radius={18} />
          <Skeleton height={96} radius={18} />
        </View>
      )}

      {/* featured room */}
      {featured && (
        <PressScale style={[styles.featured, { backgroundColor: featured.bg ?? '#2A3B22' }]} onPress={() => openRoom(featured.slug)} scaleTo={0.98}>
          <View style={[styles.glow, { backgroundColor: `${featured.accent ?? '#E2A24A'}40` }]} />
          <View style={styles.featTop}>
            <Text style={[styles.roomNo, { color: featured.accent ?? '#E2A24A' }]}>Room 01</Text>
            <Text style={[styles.enter, { color: featured.accent ?? '#E2A24A' }]}>Enter →</Text>
          </View>
          <Text style={styles.featTitle}>{featured.title}</Text>
          {!!featured.note && <Text style={styles.featNote}>{featured.note}</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18 }} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
            {featured.items.slice(0, 6).map((it) => (
              <PressScale key={`${it.kind}-${it.id}`} onPress={() => open(it)} scaleTo={0.92}>
                <BookCover item={{ type: it.kind, title: it.title, author: it.author, cover: it.cover }} w={74} r={9} />
              </PressScale>
            ))}
          </ScrollView>
        </PressScale>
      )}

      {/* smaller rooms */}
      {rest.map((rm, i) => (
        <PressScale key={rm.slug} style={styles.room} onPress={() => openRoom(rm.slug)} scaleTo={0.97}>
          <View style={[styles.roomSide, { backgroundColor: rm.bg ?? '#43395E' }]}>
            <Text style={[styles.roomSideNo, { color: rm.accent ?? '#E2A24A' }]}>{String(i + 2).padStart(2, '0')}</Text>
          </View>
          <View style={{ flex: 1, padding: 13 }}>
            <Text style={styles.roomTitle}>{rm.title}</Text>
            {!!rm.note && <Text style={styles.roomNote} numberOfLines={2}>{rm.note}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 9, alignItems: 'center' }}>
              {rm.items.slice(0, 3).map((it) => (
                <PressScale key={`${it.kind}-${it.id}`} onPress={() => open(it)} scaleTo={0.9}>
                  <BookCover item={{ type: it.kind, title: it.title, author: it.author, cover: it.cover }} w={40} r={5} />
                </PressScale>
              ))}
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Ionicons name="arrow-forward" size={17} color={colors.muted} />
              </View>
            </View>
          </View>
        </PressScale>
      ))}

      {loaded && rooms.length === 0 && <Text style={styles.empty}>No rooms yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 26, color: colors.ink },
  lede: { fontSize: 13, color: colors.muted, fontStyle: 'italic', fontFamily: serif, marginTop: 4 },
  featured: { marginTop: 18, borderRadius: 22, padding: 20, overflow: 'hidden' },
  featTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enter: { fontSize: 11, fontWeight: '700' },
  glow: { position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: 90 },
  roomNo: { fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  featTitle: { fontFamily: serif, fontSize: 23, color: '#F2ECDC', marginTop: 6, lineHeight: 27 },
  featNote: { fontSize: 13, color: '#E4DCC9', fontStyle: 'italic', fontFamily: serif, lineHeight: 19, marginTop: 8, maxWidth: 260 },
  room: { marginTop: 14, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  roomSide: { width: 64, alignItems: 'center', justifyContent: 'center' },
  roomSideNo: { fontFamily: serif, fontSize: 22 },
  roomTitle: { fontFamily: serif, fontSize: 15.5, color: colors.ink, lineHeight: 19 },
  roomNote: { fontSize: 11.5, color: colors.muted, fontStyle: 'italic', fontFamily: serif, marginTop: 4, lineHeight: 16 },
  empty: { color: colors.muted, fontSize: 13, marginTop: 24, textAlign: 'center' },
});
