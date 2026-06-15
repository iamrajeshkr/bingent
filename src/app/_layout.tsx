import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { MiniPlayer } from '@/components/mini-player';
import { PlayerProvider } from '@/lib/player';
import { PrefsProvider } from '@/lib/prefs';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <PrefsProvider>
      <PlayerProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}>
            <Stack.Screen name="player" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
          {/* Global, route-aware mini-player overlay — shows on detail screens too. */}
          <MiniPlayer />
        </View>
      </PlayerProvider>
    </PrefsProvider>
  );
}
