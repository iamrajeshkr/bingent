import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { colors, serif } from '@/lib/theme';

// Circular avatar: the uploaded image when present, else the name's initial.
export function Avatar({ uri, name, size = 36, onPress }: { uri?: string | null; name?: string; size?: number; onPress?: () => void }) {
  const body = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.indigo, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontFamily: serif, fontSize: size * 0.44, fontWeight: '600' }}>
        {(name || 'Y').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} hitSlop={8}>{body}</Pressable> : body;
}
