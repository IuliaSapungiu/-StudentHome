import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

export function BrandMark() {
  return (
    <View style={styles.row}>
      <View style={styles.logo}>
        <Ionicons name="home-outline" size={18} color="#fff" />
      </View>
      <Text style={styles.name}>StudentHouse</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
  logo: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '600', color: colors.text },
});
