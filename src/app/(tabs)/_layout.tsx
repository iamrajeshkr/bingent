import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
        // Cross-fade/shift between tabs instead of an instant cut, so switching
        // reads as one connected surface rather than a hard jump.
        animation: 'shift',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shelf',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask Bingent',
          tabBarIcon: ({ size }) => (
            <Ionicons name="sparkles" size={size} color={colors.indigo} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark-outline" size={size} color={color} />,
        }}
      />
      {/* Profile — opened from the avatar, not a tab button, but keeps the tab bar. */}
      <Tabs.Screen name="you" options={{ href: null }} />
    </Tabs>
  );
}
