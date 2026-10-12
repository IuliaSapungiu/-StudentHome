import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { describeDetail, formatNumber, isDemo, isVerified, type Property } from '@/data';
import { DemoTag } from '@/components/DemoTag';
import { useRequireAccount } from '@/features/session/useRequireAccount';

type Props = { property: Property; width?: number; initiallySaved?: boolean };

// Large photo card used on Home (featured), Search and Saved.
// Pass `width` for carousels; omit it to fill the parent (grids, lists).
export function PropertyCard({ property, width, initiallySaved = false }: Props) {
  const [saved, setSaved] = useState(initiallySaved);
  const demo = isDemo(property);
  const requireAccount = useRequireAccount();

  return (
    <View style={[styles.card, width ? { width } : null]}>
      <View>
        <Image source={{ uri: property.images[0] }} style={styles.image} />
        {isVerified(property) && (
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
            <Text style={styles.badgeText}>{demo ? 'Verified landlord · demo' : 'Verified landlord'}</Text>
          </View>
        )}
        {demo && <DemoTag style={styles.demo} />}
        <Pressable onPress={() => requireAccount(() => setSaved((v) => !v))} style={[styles.heart, saved && styles.heartOn]} hitSlop={8}>
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
        {formatNumber(property.rentRon)} lei <Text style={styles.perMonth}>/ month</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  image: { width: '100%', aspectRatio: 1.55, borderRadius: radius.lg, backgroundColor: colors.mint },
  badge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  demo: { position: 'absolute', bottom: 10, left: 10 },
  heart: { position: 'absolute', top: 10, right: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heartOn: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  title: { fontSize: 16, fontWeight: '500', color: colors.text, marginTop: 4 },
  price: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  perMonth: { fontSize: 12, fontWeight: '400', color: colors.muted },
});
