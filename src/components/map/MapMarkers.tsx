import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

// What is drawn INSIDE a map marker. Kept simple (plain views, fixed sizes) because the map library
// turns marker content into an image.

export function PricePill({ label, selected }: { label: string; selected: boolean }) {
  return (
    <View style={[styles.pill, selected && styles.pillOn]}>
      <Text style={[styles.pillText, selected && styles.pillTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ClusterBubble({ count }: { count: number }) {
  return (
    <View style={styles.cluster}>
      <Text style={styles.clusterText}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 64, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.text },
  pillTextOn: { color: '#fff' },
  cluster: { minWidth: 40, height: 40, paddingHorizontal: 8, borderRadius: 20, backgroundColor: colors.primaryDark, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  clusterText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
