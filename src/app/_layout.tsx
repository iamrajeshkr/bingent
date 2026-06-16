import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MiniPlayer } from '@/components/mini-player';
import { PlayerProvider } from '@/lib/player';
import { PrefsProvider } from '@/lib/prefs';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <PrefsProvider>
      <PlayerProvider>
        <StatusBar style="dark" />
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              // One consistent push everywhere — a smooth horizontal slide with
              // edge swipe-back — so navigation reads as connected, not abrupt.
              // (Edge swipe only, NOT full-screen, so it doesn't fight the
              // horizontal carousels / mini-player / library gestures.)
              animation: 'slide_from_right',
              animationDuration: 260,
              gestureEnabled: true,
            }}>
            {/* Entry / transition screens fade rather than slide. */}
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="threshold" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="auth" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            {/* Modals slide up from the bottom. */}
            <Stack.Screen name="player" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="library" options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: false }} />
          </Stack>
          {/* Global, route-aware mini-player overlay — shows on detail screens too. */}
          <MiniPlayer />
        </GestureHandlerRootView>
      </PlayerProvider>
    </PrefsProvider>
  );
}
