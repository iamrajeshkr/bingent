import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '@/components/avatar';
import { Spine } from '@/components/book-cover';
import { api, signOut, type FinishedItem, type Garden } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { colors, serif } from '@/lib/theme';
import type { Lang } from '@/lib/types';

const RHYTHM_LABEL = { morning: 'Morning pages', commute: 'Commute', winddown: 'Wind-down' };
const MODE_LABEL = { read: 'Read', listen: 'Listen' };

// scattered positions (% of the sky card) — stars fill these as reads finish
const STAR_POS = [
  { x: 14, y: 30 }, { x: 30, y: 58 }, { x: 43, y: 26 }, { x: 55, y: 52 }, { x: 64, y: 30 },
  { x: 75, y: 58 }, { x: 50, y: 16 }, { x: 22, y: 76 }, { x: 40, y: 82 }, { x: 58, y: 76 },
  { x: 78, y: 80 }, { x: 31, y: 18 }, { x: 86, y: 44 }, { x: 12, y: 56 },
];

export default function You() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();

  const [garden, setGarden] = useState<Garden | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to change your avatar.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0]!;
      if (!asset.base64) {
        Alert.alert('Error', 'Could not read image data.');
        return;
      }

      setUploading(true);
      const res = await api.uploadAvatar(asset.base64, asset.mimeType || 'image/jpeg');
      prefs.set({ avatarUrl: res.avatar_url });
      setGarden(prev => prev ? { ...prev, avatar_url: res.avatar_url } : null);
      Alert.alert('Success', 'Avatar updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }
    try {
      setUploading(true);
      const res = await api.updateProfile(editName.trim());
      prefs.set({ name: res.display_name });
      setGarden(prev => prev ? { ...prev, display_name: res.display_name } : null);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update display name.');
    } finally {
      setUploading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      api.getGarden().then(setGarden).catch(() => {});
    }, [])
  );

  const finished = garden?.finished ?? [];
  const streak = garden?.streak ?? 0;
  const inProgress = garden?.in_progress ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40 }}>

      {/* opened from the Shelf avatar — greet by name, with a way back */}
      {editing ? (
        <View style={styles.topBar}>
          <Pressable onPress={() => setEditing(false)} hitSlop={12}>
            <Text style={{ fontSize: 15, color: colors.muted }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={saveProfile} disabled={uploading} hitSlop={12}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.indigo} />
            ) : (
              <Text style={{ fontSize: 15, color: colors.indigo, fontWeight: '600' }}>Save</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => { setEditName(garden?.display_name || prefs.name || ''); setEditing(true); }} hitSlop={12} style={styles.editBtn}>
            <Ionicons name="create-outline" size={14} color={colors.indigo} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
        </View>
      )}

      {editing ? (
        <View style={styles.profileHeaderEdit}>
          <Pressable onPress={pickImage} style={styles.avatarEditContainer} disabled={uploading}>
            <Avatar uri={garden?.avatar_url ?? prefs.avatarUrl} name={garden?.display_name ?? prefs.name} size={80} />
            <View style={styles.avatarEditOverlay}>
              <Ionicons name="camera-outline" size={20} color="#FFF" />
            </View>
          </Pressable>
          <Text style={styles.avatarEditSub}>Tap to change photo</Text>

          <TextInput
            style={styles.nameInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Display Name"
            placeholderTextColor={colors.muted}
            maxLength={50}
          />
        </View>
      ) : (
        <View style={styles.profileHeader}>
          <Avatar uri={garden?.avatar_url ?? prefs.avatarUrl} name={garden?.display_name ?? prefs.name} size={72} />
          <View style={styles.profileText}>
            <Text style={styles.name}>{garden?.display_name || prefs.name || 'You'}</Text>
            <Text style={styles.daysLine}>{(garden?.days_used ?? prefs.daysUsed.length)} days with Bingent</Text>
          </View>
        </View>
      )}

      <GardenSection activeDays={garden?.active_days ?? []} streak={streak} />

      {/* Living Library — the shelf you're filling */}
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Your library</Text>
        <Text style={styles.sectionMeta}>{finished.length} on the shelf</Text>
      </View>
      <Text style={styles.lede}>Every finished read becomes a spine — you’re building something that lasts.</Text>
      <Pressable style={styles.shelf} onPress={() => router.push('/library' as Href)}>
        {finished.length === 0 ? (
          <Text style={styles.shelfEmpty}>Finish a read and its spine appears on your shelf.</Text>
        ) : (
          // preview rack: just enough spines to fill one shelf width, no ghosts
          <Plank items={finished.slice(0, 11)} />
        )}
        <View style={styles.shelfOpen}>
          <Text style={styles.shelfNote}>{inProgress > 0 ? `${inProgress} in progress · ` : ''}open your shelf</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.muted} />
        </View>
      </Pressable>

      {/* Inner sky — stars sized by type, clustered by theme. Tap to wander. */}
      <Pressable onPress={() => router.push('/sky' as Href)} style={[styles.sky, { marginTop: 18 }]}>
        <View style={styles.skyHead}>
          <Text style={styles.skyTag}>The sky you’re becoming</Text>
          <Text style={styles.skyCount}>{finished.length} {finished.length === 1 ? 'star' : 'stars'}</Text>
        </View>
        <View style={styles.skyField}>
          {finished.slice(0, STAR_POS.length).map((f, i) => {
            const pos = STAR_POS[i]!;
            const r = f.kind === 'journey' ? 7 : f.kind === 'summary' ? 4.5 : 3;
            return (
              <View key={`${f.kind}-${f.id}`} style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%` }}>
                <View style={{ position: 'absolute', left: -r, top: -r, width: r * 4, height: r * 4, borderRadius: r * 2, backgroundColor: '#F4ECDC', opacity: 0.12 }} />
                <View style={{ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#F8F1DE' }} />
              </View>
            );
          })}
          {finished.length === 0 && <Text style={styles.skyEmpty}>Finish a read to light your first star.</Text>}
        </View>
        <View style={styles.skyFoot}>
          <Text style={styles.skyFootText}>Tap to wander your sky</Text>
          <Ionicons name="chevron-forward" size={14} color="#9A8FD8" />
        </View>
      </Pressable>

      {/* stats */}
      <View style={styles.statsRow}>
        <Stat n={garden?.practices_kept ?? 0} label="practices kept" />
        <Stat n={garden?.pages_read ?? 0} label="pages read" />
        <Stat n={garden?.days_used ?? prefs.daysUsed.length} label="days with Bingent" />
      </View>

      {/* links */}
      <Pressable style={styles.link} onPress={() => router.push('/letter' as Href)}>
        <Ionicons name="mail-outline" size={18} color={colors.accent} />
        <Text style={styles.linkText}>A letter from Bingent</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <Pressable style={styles.link} onPress={() => router.push('/arcs' as Href)}>
        <Ionicons name="trail-sign-outline" size={18} color={colors.indigo} />
        <Text style={styles.linkText}>Becoming arcs</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <Pressable style={styles.link} onPress={() => router.push('/commonplace' as Href)}>
        <Ionicons name="bookmarks-outline" size={18} color={colors.indigo} />
        <Text style={styles.linkText}>Your commonplace book</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {!!prefs.intent && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>YOUR INTENT</Text>
          <Text style={styles.intent}>"{prefs.intent}"</Text>
        </View>
      )}

      <Text style={styles.section}>Preferences</Text>
      <Toggle label="LANGUAGE" options={(['en', 'hi'] as Lang[]).map((l) => ({ key: l, label: l === 'en' ? 'English' : 'हिंदी' }))}
        value={prefs.language} onChange={(l) => prefs.set({ language: l as Lang })} />
      <Toggle label="DEFAULT MODE" options={(['read', 'listen'] as const).map((m) => ({ key: m, label: MODE_LABEL[m] }))}
        value={prefs.mode} onChange={(m) => prefs.set({ mode: m as 'read' | 'listen' })} />
      <Toggle label="DAILY RHYTHM" options={(['morning', 'commute', 'winddown'] as const).map((r) => ({ key: r, label: RHYTHM_LABEL[r] }))}
        value={prefs.rhythm} onChange={(r) => prefs.set({ rhythm: r as 'morning' | 'commute' | 'winddown' })} />

      <Pressable style={styles.redo} onPress={() => { prefs.set({ onboarded: false }); router.replace('/onboarding'); }}>
        <Ionicons name="refresh-outline" size={15} color={colors.muted} />
        <Text style={styles.redoText}>Redo onboarding</Text>
      </Pressable>
      <Pressable style={styles.redo} onPress={async () => { await signOut(); router.replace('/auth' as Href); }}>
        <Ionicons name="log-out-outline" size={15} color={colors.accent} />
        <Text style={[styles.redoText, { color: colors.accent }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function GardenSection({ activeDays, streak }: { activeDays: string[]; streak: number }) {
  const router = useRouter();
  const daysUsed = activeDays;
  const todayIso = new Date().toISOString().slice(0, 10);
  
  const weekDates = (() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d.toISOString().slice(0, 10));
    }
    return week;
  })();

  const usedSet = new Set(daysUsed);
  const activeCount = weekDates.filter(d => usedSet.has(d)).length;

  const m = new Date().getMonth() + 1;
  const season = m === 12 || m <= 2 ? 'Winter' : m === 3 ? 'Early spring' : m <= 5 ? 'Late spring' : m <= 7 ? 'Early summer' : m === 8 ? 'Late summer' : 'Autumn';

  const daysLabel = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={styles.gardenSection}>
      <View style={styles.gardenHeaderRow}>
        <Text style={styles.h1}>Your garden</Text>
        <Text style={styles.gardenSeason}>{season}</Text>
      </View>
      <Text style={styles.gardenLede}>What you read takes root here. Tend it, and watch the season turn.</Text>

      <View style={styles.gardenGraphic}>
        <View style={styles.gardenSunHalo}>
          <View style={styles.gardenSun} />
        </View>
        
        {/* Only show full growth when active */}
        {activeCount > 0 && (
          <View style={[styles.gardenTree, { left: 40, bottom: 36 }]}>
            <View style={styles.gardenTrunk} />
            <View style={[styles.gardenLeaves, { width: 56, height: 56, borderRadius: 28, backgroundColor: '#4A8F86', left: -24, top: -46 }]} />
            <View style={[styles.gardenLeaves, { width: 44, height: 44, borderRadius: 22, backgroundColor: '#346B64', left: -8, top: -30 }]} />
          </View>
        )}

        <View style={[styles.gardenFlower, { left: 120, bottom: 36, height: activeCount > 2 ? 40 : 25 }]}>
          <View style={[styles.gardenStem, { height: activeCount > 2 ? 40 : 25 }]} />
          {activeCount > 2 && <View style={styles.gardenFlowerHead} />}
        </View>

        <View style={[styles.gardenFlower, { left: 160, bottom: 36, height: 20 }]}>
          <View style={[styles.gardenStem, { height: 20 }]} />
        </View>

        <View style={[styles.gardenFlower, { left: 200, bottom: 36, height: activeCount > 4 ? 45 : 30 }]}>
          <View style={[styles.gardenStem, { height: activeCount > 4 ? 45 : 30 }]} />
          {activeCount > 4 && <View style={styles.gardenFlowerHead} />}
        </View>

        <View style={[styles.gardenFlower, { left: 240, bottom: 36, height: 25 }]}>
          <View style={[styles.gardenStem, { height: 25 }]} />
        </View>

        {activeCount > 1 && (
          <View style={[styles.gardenTree, { right: 50, bottom: 36, transform: [{scale: 0.85}] }]}>
            <View style={styles.gardenTrunk} />
            <View style={[styles.gardenLeaves, { width: 56, height: 56, borderRadius: 28, backgroundColor: '#4A8F86', left: -24, top: -46 }]} />
            <View style={[styles.gardenLeaves, { width: 44, height: 44, borderRadius: 22, backgroundColor: '#346B64', left: -8, top: -30 }]} />
          </View>
        )}

        <View style={styles.gardenGround} />
      </View>

      <View style={styles.tendingCard}>
        <View style={styles.tendingCardHead}>
          <Text style={styles.tendingCardTitle}>{activeCount} days of tending</Text>
          <Text style={styles.tendingCardMeta}>this week</Text>
        </View>
        <View style={styles.tendingDaysRow}>
          {weekDates.map((dateStr, i) => {
            const active = usedSet.has(dateStr);
            const isToday = dateStr === todayIso;
            const isFuture = dateStr > todayIso;

            return (
              <View key={dateStr} style={styles.tendingDayCol}>
                <View style={[
                  styles.tendingCircle,
                  active ? styles.tendingCircleActive :
                  isToday ? styles.tendingCircleToday :
                  isFuture ? styles.tendingCircleFuture : styles.tendingCircleMissed
                ]}>
                  {active && <Ionicons name="leaf-outline" size={16} color="#F3E0D3" />}
                  {!active && isToday && <View style={styles.tendingDot} />}
                </View>
                <Text style={styles.tendingDayLabel}>{daysLabel[i]}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.tendingFooter}>Miss a day and nothing wilts — your garden simply waits for you.</Text>
        <Pressable style={styles.streakBtn} onPress={() => router.push('/streak' as Href)}>
          <Ionicons name="calendar-outline" size={14} color={colors.indigo} />
          <Text style={styles.streakBtnText}>{streak} day streak · open full calendar</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.indigo} />
        </Pressable>
      </View>
    </View>
  );
}

// A shelf row: spines sit on a wooden plank; ghost spines hint at what's next.
function Plank({ items, ghosts = 0, striped }: { items: FinishedItem[]; ghosts?: number; striped?: boolean }) {
  const hFor = (t: string, i: number) => (t === 'journey' ? 100 : t === 'summary' ? 84 : 66) + ((i * 7) % 11) - 5;
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={styles.plankRow}>
        {items.map((it) => (
          <Spine key={`${it.kind}-${it.id}`} item={{ type: it.kind, title: it.title }} h={hFor(it.kind, it.title.length)} />
        ))}
        {striped && <View style={styles.stripedSpine} />}
        {Array.from({ length: ghosts }).map((_, i) => (
          <View key={`g${i}`} style={styles.ghostSpine} />
        ))}
      </View>
      <View style={styles.plank} />
    </View>
  );
}

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.toggleRow}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.toggle, active ? styles.toggleActive : styles.toggleIdle]}>
              <Text style={[styles.toggleText, active && { color: colors.inkInverse }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 25, color: colors.ink, marginBottom: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontFamily: serif, fontSize: 27, color: colors.ink },
  daysLine: { fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: 0 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.indigoSoft, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 },
  editBtnText: { fontSize: 13, color: colors.indigo, fontWeight: '600' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20, marginTop: 12 },
  profileText: { flex: 1 },
  profileHeaderEdit: { alignItems: 'center', marginVertical: 12 },
  avatarEditContainer: { position: 'relative', width: 80, height: 80 },
  avatarEditOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarEditSub: { fontSize: 11.5, color: colors.muted, marginTop: 6, marginBottom: 12 },
  nameInput: { fontFamily: serif, fontSize: 20, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6, paddingHorizontal: 12, width: '80%', textAlign: 'center' },

  sky: { backgroundColor: '#181230', borderRadius: 18, padding: 16, marginBottom: 18, overflow: 'hidden' },
  skyHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  skyTag: { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: '#C4A6E8' },
  skyCount: { fontSize: 11.5, color: colors.mutedOnDark },
  skyField: { height: 150, marginTop: 10, marginBottom: 12, position: 'relative' },
  ring: { position: 'absolute', top: 6, right: 10, borderWidth: 0.8, borderColor: '#E2A24A' },
  moon: { position: 'absolute', top: 18, right: 22, width: 14, height: 14, borderRadius: 7, backgroundColor: '#F0DCA8' },
  skyEmpty: { position: 'absolute', top: '44%', left: 0, right: 0, textAlign: 'center', color: colors.mutedOnDark, fontStyle: 'italic', fontFamily: serif, fontSize: 12.5 },
  skyMeaning: { fontFamily: serif, fontSize: 12.5, lineHeight: 18, color: colors.mutedOnDark, fontStyle: 'italic' },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 10.5, color: colors.mutedOnDark },
  skyThemes: { fontSize: 11, letterSpacing: 0.4, color: '#9A8FD8', marginTop: 9 },
  skyLink: { fontSize: 11, color: '#C4A6E8', marginTop: 10, fontWeight: '600' },
  skyFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
  skyFootText: { fontSize: 12, color: '#9A8FD8' },
  shelfEmpty: { color: colors.muted, fontStyle: 'italic', fontFamily: serif, fontSize: 12.5, textAlign: 'center', paddingVertical: 18 },
  streakBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  streakBtnText: { fontSize: 12.5, color: colors.indigo, fontWeight: '600' },

  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section: { fontFamily: serif, fontSize: 16, color: colors.ink, marginTop: 4, marginBottom: 10 },
  sectionMeta: { fontSize: 11.5, color: colors.muted },
  lede: { fontSize: 12.5, color: colors.muted, fontStyle: 'italic', fontFamily: serif, marginBottom: 12, marginTop: -4 },
  shelf: { backgroundColor: '#F3EAD6', borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, paddingBottom: 10 },
  plankRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110, paddingHorizontal: 6 },
  plank: { height: 11, borderRadius: 3, backgroundColor: '#B89A6E' },
  ghostSpine: { width: 19, height: 56, borderRadius: 3, borderWidth: 1.5, borderColor: colors.track, borderStyle: 'dashed' },
  stripedSpine: { width: 23, height: 78, borderRadius: 3, backgroundColor: '#4d4368', opacity: 0.55 },
  shelfOpen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  shelfNote: { textAlign: 'center', fontSize: 11.5, color: colors.muted },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statNum: { fontFamily: serif, fontSize: 22, color: colors.ink },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 2 },

  streak: { flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: 14, padding: 14, marginBottom: 18 },
  streakTitle: { fontSize: 13.5, color: colors.ink, fontWeight: '600' },
  streakSub: { fontSize: 11.5, color: colors.muted, fontStyle: 'italic', fontFamily: serif, marginTop: 1 },

  link: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.cardAlt, borderRadius: 14, padding: 14, marginBottom: 10 },
  linkText: { flex: 1, fontFamily: serif, fontSize: 15, color: colors.ink },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginBottom: 10, marginTop: 8 },
  cardLabel: { fontSize: 10.5, letterSpacing: 1.2, color: colors.muted, fontWeight: '500', marginBottom: 8 },
  intent: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, color: colors.ink },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggle: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  toggleActive: { backgroundColor: colors.ink },
  toggleIdle: { backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggleText: { fontSize: 12.5, color: colors.ink },
  redo: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  redoText: { fontSize: 12.5, color: colors.muted },

  // Garden Section Styles
  gardenSection: { marginBottom: 20 },
  gardenHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  gardenSeason: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  gardenLede: { fontSize: 13, color: colors.muted, fontStyle: 'italic', fontFamily: serif, marginBottom: 14, marginTop: -4 },
  
  gardenGraphic: { backgroundColor: '#C8B699', height: 160, borderRadius: 18, overflow: 'hidden', position: 'relative', marginBottom: 14 },
  gardenGround: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, backgroundColor: '#837055' },
  gardenSunHalo: { position: 'absolute', top: 16, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(215, 169, 83, 0.3)', alignItems: 'center', justifyContent: 'center' },
  gardenSun: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#CBA14C' },
  gardenTree: { position: 'absolute' },
  gardenTrunk: { width: 6, height: 26, backgroundColor: '#574231', borderRadius: 3 },
  gardenLeaves: { position: 'absolute' },
  gardenFlower: { position: 'absolute', alignItems: 'center' },
  gardenStem: { width: 3, backgroundColor: '#586A45', borderRadius: 1.5 },
  gardenFlowerHead: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#8D70A3', position: 'absolute', top: -6 },
  
  tendingCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16 },
  tendingCardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 },
  tendingCardTitle: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  tendingCardMeta: { fontSize: 12, color: colors.muted },
  tendingDaysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 16 },
  tendingDayCol: { alignItems: 'center', gap: 6 },
  tendingCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tendingCircleActive: { backgroundColor: '#B84A2A' },
  tendingCircleToday: { backgroundColor: '#E0D6C2' },
  tendingCircleFuture: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E0D6C2' },
  tendingCircleMissed: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E0D6C2' },
  tendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8C8270' },
  tendingDayLabel: { fontSize: 11, color: colors.muted },
  tendingFooter: { fontSize: 12.5, color: colors.muted, fontStyle: 'italic', fontFamily: serif, textAlign: 'center' },
});
