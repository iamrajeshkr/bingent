import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Tappable surface with immediate tactile feedback: on press-down it dips
 * (scale + dim) so the tap registers visually the instant a finger lands —
 * before the navigation/playback it triggers actually resolves. Drop-in
 * replacement for <Pressable> on cards, chips, tiles, and buttons.
 */
export function PressScale({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  dim = 0.18,
  haptic = false,
  ...rest
}: PressableProps & { scaleTo?: number; dim?: number; haptic?: boolean }) {
  const p = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * p.value }],
    opacity: 1 - dim * p.value,
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      onPressIn={(e) => { p.value = withTiming(1, { duration: 90 }); onPressIn?.(e); }}
      onPressOut={(e) => { p.value = withTiming(0, { duration: 150 }); onPressOut?.(e); }}
      style={[style as object, animStyle]}>
      {children as any}
    </AnimatedPressable>
  );
}
