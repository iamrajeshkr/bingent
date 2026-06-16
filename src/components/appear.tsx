import type { ReactNode } from 'react';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

// Eases content in when it mounts/arrives, so async-loaded sections (recs,
// search results, replies) settle in instead of popping/jumping. Keep durations
// short so it reads as "connected", not slow.
export function Appear({ children, delay = 0, y = true, style }: { children: ReactNode; delay?: number; y?: boolean; style?: any }) {
  const anim = (y ? FadeInDown : FadeIn).duration(260).delay(delay);
  return <Animated.View entering={anim} style={style}>{children}</Animated.View>;
}
