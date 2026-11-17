import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { isHourSelectable, isTimeSelectable, nearestEnabled } from '@/features/viewings/viewingRules';

const ITEM_H = 44;
const VISIBLE = 5; // odd: the middle row is the selected one
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, '0');

type WheelProps = {
  label: string;
  values: number[];
  selected: number;
  isEnabled: (value: number) => boolean;
  onSelect: (value: number) => void;
};

/** One scrolling column. Scroll or tap to choose; values that are not allowed (past times) are greyed and cannot be chosen. */
function Wheel({ label, values, selected, isEnabled, onSelect }: WheelProps) {
  const ref = useRef<ScrollViewInstance>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settledIndex = useRef(-1);
  const laidOut = useRef(false);
  const index = values.indexOf(selected);

  const scrollToIndex = useCallback((i: number, animated: boolean) => {
    settledIndex.current = i;
    ref.current?.scrollTo({ y: i * ITEM_H, animated });
  }, []);

  // Follow the selected value when it changes from outside (a new date, a default time, the other wheel).
  useEffect(() => {
    if (index >= 0 && settledIndex.current !== index) {
      const t = setTimeout(() => scrollToIndex(index, settledIndex.current !== -1), 0);
      return () => clearTimeout(t);
    }
  }, [index, scrollToIndex]);

  const settle = useCallback(
    (y: number) => {
      let i = Math.min(values.length - 1, Math.max(0, Math.round(y / ITEM_H)));
      if (!isEnabled(values[i])) {
        const near = nearestEnabled(values.length, i, (k) => isEnabled(values[k]));
        if (near < 0) return;
        i = near;
      }
      scrollToIndex(i, true);
      if (values[i] !== selected) onSelect(values[i]);
    },
    [values, isEnabled, selected, onSelect, scrollToIndex],
  );

  // Works the same on iOS, Android and web: wait until scrolling stops, then snap to the nearest allowed row.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => settle(y), 110);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const step = (dir: 1 | -1) => {
    for (let k = index + dir; k >= 0 && k < values.length; k += dir) {
      if (isEnabled(values[k])) {
        scrollToIndex(k, true);
        onSelect(values[k]);
        return;
      }
    }
  };

  return (
    <View style={styles.column}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => step(-1)} hitSlop={6} style={styles.step}>
        <Ionicons name="chevron-up" size={18} color={colors.muted} />
      </Pressable>
      <View
        style={styles.window}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: pad(selected) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
        <View pointerEvents="none" style={styles.band} />
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          // Once the rows exist (Android can run the first scroll too early), put the initial value in the middle.
          onContentSizeChange={() => {
            if (!laidOut.current && index >= 0) {
              laidOut.current = true;
              scrollToIndex(index, false);
            }
          }}
          contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}>
          {values.map((v, i) => {
            const enabled = isEnabled(v);
            return (
              <Pressable
                key={v}
                accessible={false}
                disabled={!enabled}
                onPress={() => { scrollToIndex(i, true); onSelect(v); }}
                style={styles.item}>
                <Text style={[styles.itemText, v === selected && styles.itemOn, !enabled && styles.itemOff]}>{pad(v)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => step(1)} hitSlop={6} style={styles.step}>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

type Props = { date: string; hour: number; minute: number; nowLocal: string; onChange: (hour: number, minute: number) => void };

/**
 * Exact time of day, hour and minute (00-59), like the phone's alarm picker. 24-hour clock. Times that have
 * already passed today are greyed and cannot be chosen. No fixed list of slots: any minute is allowed.
 */
export function TimeWheelPicker({ date, hour, minute, nowLocal, onChange }: Props) {
  const hourOk = useCallback((h: number) => isHourSelectable(date, h, nowLocal), [date, nowLocal]);
  const minuteOk = useCallback((m: number) => isTimeSelectable(date, hour, m, nowLocal), [date, hour, nowLocal]);

  const pickHour = (h: number) => {
    const m = isTimeSelectable(date, h, minute, nowLocal) ? minute : nearestEnabled(60, minute, (i) => isTimeSelectable(date, h, i, nowLocal));
    onChange(h, m < 0 ? minute : m);
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Time of day, 24-hour clock">
      <Wheel label="hour" values={HOURS} selected={hour} isEnabled={hourOk} onSelect={pickHour} />
      <Text style={styles.colon}>:</Text>
      <Wheel label="minute" values={MINUTES} selected={minute} isEnabled={minuteOk} onSelect={(m) => onChange(hour, m)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm },
  column: { alignItems: 'center', width: 96 },
  step: { height: 28, alignItems: 'center', justifyContent: 'center', width: '100%' },
  window: { height: ITEM_H * VISIBLE, width: '100%', overflow: 'hidden' },
  band: { position: 'absolute', left: 6, right: 6, top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H, borderRadius: radius.sm, backgroundColor: colors.mint, opacity: 0.7 },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 22, color: colors.text },
  itemOn: { fontWeight: '700', color: colors.primary },
  itemOff: { color: '#C3CBC6' },
  colon: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 4 },
});
