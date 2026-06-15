import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '@/lib/theme';

// A gently pulsing placeholder block. Cheaper-feeling than a spinner because it
// hints at the shape of the content that's about to arrive.
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o]);
  const aStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.track }, aStyle, style]} />;
}

// A small stack of lines for body-text placeholders.
export function SkeletonLines({ count = 5, last = '60%' as DimensionValue }) {
  return (
    <View style={styles.lines}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === count - 1 ? last : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: 11 },
});
