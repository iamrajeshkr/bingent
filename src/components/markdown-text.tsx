import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, serif } from '@/lib/theme';

// Lightweight renderer for the markdown-ish content in the catalog:
// ##/### headings, **bold** segments, --- dividers, paragraphs.
// Long-press a paragraph to ask Bingent about that line (when onAskLine is given).
export function MarkdownText({ content, onAskLine }: { content: string; onAskLine?: (line: string) => void }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (/^-{3,}$/.test(trimmed)) return <View key={i} style={styles.divider} />;
        const heading = trimmed.match(/^(#{1,4})\s+(.*)$/s);
        if (heading) {
          const level = heading[1].length;
          return (
            <Text key={i} selectable={false} style={[styles.heading, level >= 3 && styles.heading3]}>
              {stripInline(heading[2])}
            </Text>
          );
        }
        return (
          <Pressable
            key={i}
            onLongPress={onAskLine ? () => onAskLine(trimmed.replace(/\*\*/g, '')) : undefined}
            delayLongPress={280}>
            {/* selectable={false} stops the browser's text-selection from hijacking the long-press on web */}
            <Text selectable={false} style={styles.para}>{renderBold(trimmed)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const stripInline = (s: string) => s.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={i} style={{ fontWeight: '700' }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    )
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: serif, fontSize: 20, color: colors.ink, marginBottom: 12, lineHeight: 27 },
  heading3: { fontSize: 17 },
  para: { fontSize: 15, lineHeight: 24, color: colors.ink, marginBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 14 },
});
