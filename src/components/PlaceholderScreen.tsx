import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

// Title-only screen for tabs that get built from the Figma design in a later step.
export function PlaceholderScreen({ title, note }: { title: string; note?: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'left', 'right']}>
      <View style={{ padding: 20, gap: 8 }}>
        <Text style={{ fontSize: 28, color: colors.text }}>{title}</Text>
        {note ? <Text style={{ fontSize: 13, color: colors.muted }}>{note}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
