import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

export function DemoNotice() {
  return (
    <View style={styles.box}>
      <Ionicons name="information-circle-outline" size={18} color="#8A5A00" />
      <Text style={styles.text}>
        Demo listings are fictional examples. They are not real properties or landlords, and any
        Verified badge is for demonstration only.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.warning, borderRadius: radius.md, padding: 12 },
  text: { flex: 1, fontSize: 12, lineHeight: 17, color: '#6B4600' },
});
