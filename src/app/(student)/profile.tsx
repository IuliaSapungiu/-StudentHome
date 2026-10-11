import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

// Placeholder: this screen gets built from the Figma design in a later step.
export default function ProfileScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 28, color: colors.text }}>Profile</Text>
      </View>
    </SafeAreaView>
  );
}
