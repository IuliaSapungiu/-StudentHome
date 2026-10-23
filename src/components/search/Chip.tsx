import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows a small "x" and calls this to remove the chip (used for active filters). */
  onRemove?: () => void;
  accessibilityLabel?: string;
};

// Pill used for quick filters, active-filter indicators and option groups on the Filters screen.
export function Chip({ label, selected = false, onPress, onRemove, accessibilityLabel }: Props) {
  const removable = !!onRemove;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (removable ? `Remove filter ${label}` : label)}
      accessibilityState={{ selected }}
      onPress={removable ? onRemove : onPress}
      style={[styles.chip, (selected || removable) && styles.chipOn]}>
      <Text style={[styles.text, (selected || removable) && styles.textOn]}>{label}</Text>
      {removable && <Ionicons name="close" size={13} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.mint, borderColor: colors.primary },
  text: { fontSize: 12, color: colors.text },
  textOn: { color: colors.primary, fontWeight: '600' },
});
