import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { compareYearMonth, monthGrid, shiftMonth, WEEKDAY_SHORT, yearMonthOf } from '@/lib/calendar';
import { formatDateLong, monthName } from '@/lib/dateTime';

type Props = {
  /** Selected day, YYYY-MM-DD. */
  selected: string | null;
  onSelect: (isoDate: string) => void;
  /** First and last selectable day (inclusive). Other days are shown but cannot be chosen. */
  min: string;
  max: string;
  /** Days that exist but have nothing to offer (for example, no free time slots) are disabled with this. */
  isDisabled?: (isoDate: string) => boolean;
};

// Custom month calendar (no extra dependency). Weeks start on Monday.
export function MonthCalendar({ selected, onSelect, min, max, isDisabled }: Props) {
  const first = yearMonthOf(min);
  const last = yearMonthOf(max);
  const [shown, setShown] = useState(yearMonthOf(selected ?? min));
  const grid = useMemo(() => monthGrid(shown), [shown]);
  const canPrev = compareYearMonth(shown, first) > 0;
  const canNext = compareYearMonth(shown, last) < 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canPrev} onPress={() => setShown(shiftMonth(shown, -1))} style={[styles.nav, !canPrev && styles.navOff]} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.month} accessibilityRole="header">{monthName(shown.month)} {shown.year}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={!canNext} onPress={() => setShown(shiftMonth(shown, 1))} style={[styles.nav, !canNext && styles.navOff]} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {WEEKDAY_SHORT.map((d) => (
          <Text key={d} style={styles.weekday}>{d}</Text>
        ))}
      </View>
      {grid.map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((date, j) => {
            if (!date) return <View key={j} style={styles.cell} />;
            const disabled = date < min || date > max || (isDisabled?.(date) ?? false);
            const on = date === selected;
            return (
              <Pressable
                key={j}
                accessibilityRole="button"
                accessibilityLabel={formatDateLong(date)}
                accessibilityState={{ disabled, selected: on }}
                disabled={disabled}
                onPress={() => onSelect(date)}
                style={styles.cell}>
                <View style={[styles.day, on && styles.dayOn]}>
                  <Text style={[styles.dayText, disabled && styles.dayOff, on && styles.dayTextOn]}>{Number(date.slice(8))}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  nav: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navOff: { opacity: 0.35 },
  month: { fontSize: 15, fontWeight: '700', color: colors.text },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.muted, paddingBottom: 6 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: '84%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.primary },
  dayText: { fontSize: 14, color: colors.text },
  dayOff: { color: '#B8C2BC' },
  dayTextOn: { color: '#fff', fontWeight: '700' },
});
