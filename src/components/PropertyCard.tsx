import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { describeDetail, isDemo, isVerified, type Property } from '@/data';
import { DemoTag } from '@/components/DemoTag';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useSaved } from '@/features/saved/SavedProvider';
import { useSearch } from '@/features/search/SearchProvider';

type Props = { property: Property; width?: number };

// Large photo card used on Home (featured), Search and Saved.
// Pass `width` for carousels; omit it to fill the parent (grids, lists).
// The price follows the student's display currency; the heart is shared app-wide (see SavedProvider).
export function PropertyCard({ property, width }: Props) {
  const router = useRouter();
  const { formatPrice } = useSearch();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(property.id);
  const demo = isDemo(property);
  const price = formatPrice(property.rent);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${property.title}, ${price} per month`}
      onPress={() => router.push({ pathname: '/property/[id]', params: { id: property.id } })}
      style={[styles.card, width ? { width } : null]}>
      <View>
        <Image source={{ uri: property.images[0] }} style={styles.image} />
        {isVerified(property) && <VerifiedBadge demo={demo} style={styles.badge} />}
        {demo && <DemoTag style={styles.demo} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save home'}
          onPress={() => toggleSaved(property.id)}
          style={[styles.heart, saved && styles.heartOn]}
          hitSlop={8}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? '#fff' : colors.text} />
        </Pressable>
      </View>
      <View style={styles.row}>
        <Ionicons name="location-outline" size={13} color={colors.muted} />
        <Text style={styles.meta}>{property.area}, {property.city}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
      <Text style={styles.meta}>{describeDetail(property)}</Text>
      <Text style={styles.price}>
        {price} <Text style={styles.perMonth}>/ month</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  image: { width: '100%', aspectRatio: 1.55, borderRadius: radius.lg, backgroundColor: colors.mint },
  badge: { position: 'absolute', top: 10, left: 10 },
  demo: { position: 'absolute', bottom: 10, left: 10 },
  heart: { position: 'absolute', top: 10, right: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heartOn: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  title: { fontSize: 16, fontWeight: '500', color: colors.text, marginTop: 4 },
  price: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  perMonth: { fontSize: 12, fontWeight: '400', color: colors.muted },
});
