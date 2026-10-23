import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { CURRENCIES, type Currency } from '@/features/currency/types';

const LABEL: Record<Currency, string> = { RON: 'RON (lei)', EUR: 'EUR (€)' };

// Two-option segmented control for the display currency.
export function CurrencySelector({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {CURRENCIES.map((c) => (
        <Pressable
          key={c}
          accessibilityRole="radio"
          accessibilityState={{ selected: c === value }}
          accessibilityLabel={`Display prices in ${c}`}
          onPress={() => onChange(c)}
          style={[styles.seg, c === value && styles.segOn]}>
          <Text style={[styles.text, c === value && styles.textOn]}>{LABEL[c]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: colors.mint, borderRadius: radius.md, padding: 4 },
  seg: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  text: { fontSize: 14, color: colors.muted },
  textOn: { color: colors.primary, fontWeight: '700' },
});
