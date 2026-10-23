import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';

// A titled block on the Filters screen, separated from the next by a hairline.
export function FilterSection({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <View style={styles.section} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {children}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

export const ChipRow = ({ children }: { children: ReactNode }) => <View style={styles.chips}>{children}</View>;

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 15, fontWeight: '500', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
