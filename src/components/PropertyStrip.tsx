import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PropertyImage } from '@/components/PropertyImage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import type { Property } from '@/data';
import { useSearch } from '@/features/search/SearchProvider';

// Compact "which home is this about" row used in the chat header and on the request / application screens.
export function PropertyStrip({ property }: { property: Property }) {
  const router = useRouter();
  const { formatPrice } = useSearch();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${property.title}, ${formatPrice(property.rent)} per month. Open listing`}
      onPress={() => router.push({ pathname: '/property/[id]', params: { id: property.id } })}
      style={styles.row}>
      <PropertyImage compact uri={property.images[0]} style={styles.thumb} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
        <Text style={styles.price}>{formatPrice(property.rent)} / month</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.mint },
  title: { fontSize: 13, fontWeight: '700', color: colors.text },
  price: { fontSize: 12, color: colors.primary },
});
