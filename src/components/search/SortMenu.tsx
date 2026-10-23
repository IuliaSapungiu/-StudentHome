import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import type { SortOption } from '@/data';
import { SORT_LABEL, SORT_OPTIONS } from '@/features/search/searchState';

type Props = { value: SortOption; onChange: (sort: SortOption) => void };

// "Recommended ›" link under the search field; opens a small list of sort choices.
export function SortMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Sort: ${SORT_LABEL[value]}`} onPress={() => setOpen(true)} hitSlop={8} style={styles.trigger}>
        <Text style={styles.triggerText}>{SORT_LABEL[value]}</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.muted} />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)} supportedOrientations={['portrait', 'landscape']}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.title}>Sort by</Text>
            {SORT_OPTIONS.map((o) => (
              <Pressable
                key={o}
                accessibilityRole="radio"
                accessibilityState={{ selected: o === value }}
                onPress={() => {
                  onChange(o);
                  setOpen(false);
                }}
                style={styles.row}>
                <Text style={[styles.rowText, o === value && styles.rowTextOn]}>{SORT_LABEL[o]}</Text>
                {o === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  triggerText: { fontSize: 12, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, padding: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.sm },
  rowText: { fontSize: 15, color: colors.text },
  rowTextOn: { color: colors.primary, fontWeight: '600' },
});
