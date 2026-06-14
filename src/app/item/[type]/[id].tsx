import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioBar } from '@/components/audio-bar';
import { MarkdownText } from '@/components/markdown-text';
import { AskLineSheet } from '@/components/ask-line-sheet';
import { api, type Position } from '@/lib/api';
import { fetchItem, journeyChapters } from '@/lib/content';
import { usePrefs } from '@/lib/prefs';
import { colors, serif, typeColors } from '@/lib/theme';
import type { Bite, ItemType, Journey, JourneyChapter, Lang, Summary } from '@/lib/types';

function fmtSecs(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export default function ItemDetail() {
  const { type, id } = useLocalSearchParams<{ type: ItemType; id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const prefs = usePrefs();

  const [row, setRow] = useState<Bite | Summary | Journey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(prefs.language);
  // Audio player is shown alongside the text by default; this just collapses it.
  const [listening, setListening] = useState(true);
  const [chapter, setChapter] = useState<JourneyChapter | null>(null);
  const [askQuote, setAskQuote] = useState<string | null>(null);
  const [resumePos, setResumePos] = useState<Position | null>(null);
  const lastReport = useRef({ sec: 0, dur: 0 });

  useEffect(() => {
    fetchItem(type, id)
      .then(setRow)
      .catch((e) => setError(String(e?.message ?? e)));
    // Cross-device resume: load the saved position for this item.
    api.getProgress(type, id).then((r) => setResumePos(r.position)).catch(() => {});
  }, [type, id]);

  const isJourney = type === 'journey';
  const journey = isJourney ? (row as Journey | null) : null;
  const chapters = useMemo(() => (journey ? journeyChapters(journey, lang) : []), [journey, lang]);

  // Resume where the user left off (which chapter, for journeys).
  useEffect(() => {
    if (journey && chapters.length && !chapter) {
      const seq = resumePos?.chapterSeq;
      const resume = seq != null ? chapters.find((c) => c.seq === seq) : undefined;
      setChapter(resume ?? chapters[0]);
    }
  }, [journey, chapters, chapter, resumePos]);

  // Persist position to the backend (throttled upstream by the AudioBar).
  const persist = (audioSec: number, durationSec: number, completed: boolean) => {
    lastReport.current = { sec: audioSec, dur: durationSec };
    const position: Position =
      isJourney && chapter
        ? { chapterSeq: chapter.seq, section: chapter.section_title, totalChapters: chapters.length, audioSec, durationSec, completed }
        : { audioSec, durationSec, completed };
    api.saveProgress(type, id, position).catch(() => {});
  };

  // Selecting a journey chapter resets the resume point to that chapter's start.
  const selectChapter = (c: JourneyChapter) => {
    setChapter(c);
    api
      .saveProgress('journey', id, { chapterSeq: c.seq, section: c.section_title, totalChapters: chapters.length, audioSec: 0, completed: false })
      .catch(() => {});
  };

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!row) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const bilingualTitle =
    (type === 'byte' && (row as Bite).title_bilingual?.[lang]) || row.title || 'Untitled';
  const author =
    (type === 'byte' && (row as Bite).author_bilingual?.[lang]) || row.author || '';
  const saved = prefs.saved.includes(row.id);

  // Text + audio for the current selection
  let bodyText: string | undefined;
  let audioUrl: string | undefined;
  if (isJourney && journey) {
    const key = chapter ? `${chapter.section}.${chapter.subsection}` : null;
    bodyText =
      (key && journey.content_chapterwise?.[lang]?.[key]) ||
      (key && journey.content_chapterwise?.en?.[key]) ||
      undefined;
    audioUrl = chapter?.url;
  } else {
    const r = row as Bite | Summary;
    bodyText = r.content?.[lang] ?? r.content?.en ?? undefined;
    audioUrl = r.audio?.[lang]?.url ?? r.audio?.en?.url ?? undefined;
  }

  // Group journey chapters by section for the table of contents
  const sections = new Map<string, JourneyChapter[]>();
  for (const c of chapters) {
    if (!sections.has(c.section_title)) sections.set(c.section_title, []);
    sections.get(c.section_title)!.push(c);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 + (audioUrl && listening ? 90 : 0) }}>
        <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
          <View style={styles.heroTop}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={colors.inkInverse} />
            </Pressable>
            <Pressable onPress={() => prefs.toggleSaved(row.id)} hitSlop={10}>
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={saved ? colors.accent : colors.inkInverse}
              />
            </Pressable>
          </View>
          <View style={styles.heroBody}>
            {row.cover ? (
              <Image source={{ uri: row.cover }} style={styles.cover} contentFit="cover" transition={200} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTag, { color: colors.mutedOnDark }]}>
                {type === 'byte' ? 'Byte' : type === 'journey' ? 'Journey' : 'Summary'}
                {type === 'byte' && (row as Bite).category ? ` · ${(row as Bite).category}` : ''}
              </Text>
              <Text style={styles.heroTitle}>{bilingualTitle}</Text>
              {!!author && <Text style={styles.heroAuthor}>{author}</Text>}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <View style={styles.controls}>
            {(['en', 'hi'] as Lang[]).map((l) => {
              const active = lang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}>
                  <Text style={[styles.pillText, active && { color: colors.inkInverse }]}>
                    {l === 'en' ? 'English' : 'हिंदी'}
                  </Text>
                </Pressable>
              );
            })}
            <View style={{ flex: 1 }} />
            {audioUrl ? (
              <Pressable
                onPress={() => setListening(!listening)}
                style={[styles.pill, styles.pillIdle, { flexDirection: 'row', gap: 5, alignItems: 'center' }]}>
                <Ionicons
                  name={listening ? 'chevron-down' : 'headset-outline'}
                  size={13}
                  color={colors.ink}
                />
                <Text style={styles.pillText}>{listening ? 'Hide audio' : 'Listen'}</Text>
              </Pressable>
            ) : null}
            {type === 'byte' && (row as Bite).difficulty ? (
              <View style={[styles.diff]}>
                <Text style={styles.diffText}>{(row as Bite).difficulty}</Text>
              </View>
            ) : null}
          </View>

          {isJourney && chapter && (
            <View style={styles.chapterBanner}>
              <Text style={[styles.heroTag, { color: typeColors.journey }]}>
                {chapter.section_title}
              </Text>
              <Text style={styles.chapterTitle}>{chapter.title}</Text>
            </View>
          )}

          {/* Text is always shown; the audio player docks alongside it (below). */}
          {bodyText ? (
            <MarkdownText content={bodyText} onAskLine={setAskQuote} />
          ) : (
            <Text style={styles.empty}>
              {lang === 'hi' ? 'इस भाषा में पाठ उपलब्ध नहीं है।' : 'No text available for this language.'}
            </Text>
          )}

          {isJourney && (
            <>
              <Text style={styles.tocHeader}>Chapters</Text>
              {[...sections.entries()].map(([sectionTitle, list]) => (
                <View key={sectionTitle}>
                  <Text style={styles.sectionLabel}>{sectionTitle}</Text>
                  {list.map((c) => {
                    const active = chapter?.seq === c.seq;
                    return (
                      <Pressable
                        key={c.seq}
                        onPress={() => selectChapter(c)}
                        style={[styles.chapterRow, active && { borderColor: colors.indigo, borderWidth: 1.5 }]}>
                        <Text style={[styles.chapterRowTitle, active && { color: colors.indigo }]} numberOfLines={1}>
                          {c.title}
                        </Text>
                        <Text style={styles.chapterDur}>{fmtSecs(c.duration)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {listening && audioUrl && (
        <View style={[styles.playerDock, { paddingBottom: insets.bottom + 10 }]}>
          <AudioBar
            key={audioUrl}
            url={audioUrl}
            startAt={
              isJourney
                ? (chapter?.seq === resumePos?.chapterSeq ? resumePos?.audioSec ?? 0 : 0)
                : resumePos?.audioSec ?? 0
            }
            onProgress={(sec, dur) => persist(sec, dur, dur > 0 && sec / dur > 0.95)}
            onFinish={() => {
              if (isJourney && chapter) {
                const next = chapters.find((c) => c.seq === chapter.seq + 1);
                if (next) selectChapter(next);
                else persist(lastReport.current.dur, lastReport.current.dur, true); // journey done
              } else {
                persist(lastReport.current.dur, lastReport.current.dur, true);
              }
            }}
          />
        </View>
      )}

      {askQuote && (
        <AskLineSheet kind={type} id={id} lang={lang} quote={askQuote} onClose={() => setAskQuote(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  error: { color: colors.accent, fontSize: 13, paddingHorizontal: 30, textAlign: 'center' },
  hero: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  heroBody: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cover: { width: 64, height: 84, borderRadius: 10, backgroundColor: colors.muted },
  heroTag: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '500' },
  heroTitle: { fontFamily: serif, fontSize: 20, lineHeight: 26, color: colors.inkInverse, marginTop: 4 },
  heroAuthor: { fontSize: 11.5, color: colors.mutedOnDark, marginTop: 3 },
  controls: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  pill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 },
  pillActive: { backgroundColor: colors.ink },
  pillIdle: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pillText: { fontSize: 12, color: colors.ink },
  diff: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  diffText: { fontSize: 10.5, color: colors.accent, letterSpacing: 0.5 },
  chapterBanner: { marginBottom: 12 },
  chapterTitle: { fontFamily: serif, fontSize: 18, color: colors.ink, marginTop: 3 },
  empty: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginVertical: 10 },
  tocHeader: { fontFamily: serif, fontSize: 17, color: colors.ink, marginTop: 10, marginBottom: 6 },
  sectionLabel: {
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 6,
  },
  chapterRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chapterRowTitle: { fontFamily: serif, fontSize: 13.5, color: colors.ink, flex: 1 },
  chapterDur: { fontSize: 10.5, color: colors.muted },
  playerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
