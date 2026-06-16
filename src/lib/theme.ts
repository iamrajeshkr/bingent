import { Platform } from 'react-native';

// Palette lifted from the design mockups
export const colors = {
  bg: '#F8F4EB',
  card: '#FFFDF7',
  cardAlt: '#F0E8D8',
  border: '#E4DBC8',
  ink: '#26203A',
  inkInverse: '#F8F4EB',
  muted: '#7A7290',
  mutedOnDark: '#CFC8E0',
  accent: '#C75B39', // terracotta — bytes, CTAs
  accentSoft: '#F3E0D3',
  indigo: '#4B3F8C', // journeys, Ask Bingent
  indigoSoft: '#EDE9F7',
  track: '#E0D6C2',
};

export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

export const typeColors: Record<string, string> = {
  byte: colors.accent,
  journey: colors.indigo,
  summary: colors.muted,
};

export const typeSoftColors: Record<string, string> = {
  byte: colors.accentSoft,
  journey: colors.indigoSoft,
  summary: colors.cardAlt,
};
