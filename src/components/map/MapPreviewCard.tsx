import { useMemo, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { describeAmenity, describeDetail, isDemo, isVerified, type Property } from '@/data';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useSaved } from '@/features/saved/SavedProvider';
import { useSearch } from '@/features/search/SearchProvider';

type Props = { property: Property; onOpen: (id: string) => void; onLayout?: (e: LayoutChangeEvent) => void };

// Bottom card shown when a price marker is selected. Tapping the card opens Property Detail.
// The handle on top can be tapped or swiped up/down to show a little more (stretch feature).
export function MapPreviewCard({ property, onOpen, onLayout }: Props) {
  const { formatPrice } = useSearch();
  const { isSaved, toggleSaved } = useSaved();
  const [expanded, setExpanded] = useState(false);
  const saved = isSaved(property.id);
  const demo = isDemo(property);

  const handle = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -18) setExpanded(true);
          else if (g.dy > 18) setExpanded(false);
          else setExpanded((v) => !v);
        },
      }),
    [],
  );

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View {...handle.panHandlers} style={styles.handleArea} accessibilityRole="button" accessibilityLabel={expanded ? 'Show less' : 'Show more'}>
        <View style={styles.handle} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${property.title}`} onPress={() => onOpen(property.id)} style={styles.row}>
        <Image source={{ uri: property.images[0] }} style={styles.thumb} />
        <View style={styles.info}>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={12} color={colors.muted} />
            <Text style={styles.meta} numberOfLines={1}>{property.area}, {property.city}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{property.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{describeDetail(property)}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(property.rent)}</Text>
            <Text style={styles.meta}>/ month</Text>
            {isVerified(property) && <VerifiedBadge variant="shield" demo={demo} />}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save home'}
          onPress={() => toggleSaved(property.id)}
          hitSlop={8}
          style={styles.heart}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.primary : colors.text} />
        </Pressable>
      </Pressable>
      {expanded && (
        <View style={styles.more}>
          <Text style={styles.desc} numberOfLines={3}>{property.description}</Text>
          <View style={styles.tags}>
            {property.amenities.slice(0, 4).map((a) => (
              <View key={a} style={styles.tag}>
                <Text style={styles.tagText}>{describeAmenity(a)}</Text>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => onOpen(property.id)} style={styles.openBtn}>
            <Text style={styles.openText}>View details</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  handleArea: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 84, height: 84, borderRadius: radius.sm, backgroundColor: colors.mint },
  info: { flex: 1, gap: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 12, color: colors.muted },
  title: { fontSize: 15, fontWeight: '500', color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '700', color: colors.text },
  heart: { alignSelf: 'flex-start', padding: 2 },
  more: { gap: spacing.sm, marginTop: spacing.md },
  desc: { fontSize: 13, lineHeight: 18, color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.mint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: colors.primary },
  openBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: radius.md, backgroundColor: colors.primary },
  openText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
