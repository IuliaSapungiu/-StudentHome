import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

type Props = {
  /** 'pill' sits on photos, 'shield' is the small icon for compact thumbnails, 'inline' is plain text with an icon. */
  variant?: 'pill' | 'shield' | 'inline';
  demo?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * "Verified landlord": shown ONLY from the landlord's identity verification (see isVerified in
 * src/data/listing.ts). It is never tied to a subscription plan and says nothing about the property.
 * Callers decide whether to render it; this component just draws it consistently everywhere.
 */
export function VerifiedBadge({ variant = 'pill', demo = false, style }: Props) {
  const label = demo ? 'Verified landlord · demo' : 'Verified landlord';
  if (variant === 'shield') {
    return (
      <View accessibilityLabel={label} style={[styles.shield, style]}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
      </View>
    );
  }
  if (variant === 'inline') {
    return (
      <View style={[styles.inline, style]}>
        <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
        <Text style={styles.inlineText}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, style]}>
      <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  shield: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inlineText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});
