import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

// Small label for fictional listings. Never shown on real (user) listings.
export function DemoTag({ style }: { style?: object }) {
  return (
    <View style={[styles.tag, style]}>
      <Text style={styles.text}>Demo listing</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', backgroundColor: colors.warning, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: '600', color: '#8A5A00' },
});
