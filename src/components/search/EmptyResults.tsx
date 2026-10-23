import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';

type Props = { hasFilters: boolean; onClear: () => void };

export function EmptyResults({ hasFilters, onClear }: Props) {
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={styles.icon}>
        <Ionicons name="search-outline" size={26} color={colors.primary} />
      </View>
      <Text style={styles.title}>{hasFilters ? 'No homes match these filters' : 'No homes found'}</Text>
      <Text style={styles.text}>
        {hasFilters ? 'Try removing a filter or widening your budget.' : 'Try a different city, university or neighborhood.'}
      </Text>
      <View style={{ width: '100%', maxWidth: 280 }}>
        <Button label={hasFilters ? 'Clear all filters' : 'Clear search'} onPress={onClear} variant="outline" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl * 1.5, paddingHorizontal: spacing.lg },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  text: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
});
