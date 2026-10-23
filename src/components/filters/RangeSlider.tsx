import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '@/theme';
import type { BudgetDomain } from '@/features/search/budget';
import { fractionToValue, moveThumb, valueToFraction, type Thumbs } from '@/features/search/rangeSlider';

type Props = {
  domain: BudgetDomain;
  /** Current thumb values in the display currency. */
  low: number;
  high: number;
  /** Called once when a drag ends (or after an accessibility step). */
  onCommit: (thumbs: Thumbs) => void;
};

const THUMB = 26;
const TOUCH = 44;

// Two-thumb range slider. All the maths (values, snapping, keeping thumbs apart) lives in
// src/features/search/rangeSlider.ts and is unit-tested; this only turns touches into fractions.
export function RangeSlider({ domain, low, high, onCommit }: Props) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<Thumbs | null>(null);
  const live: Thumbs = drag ?? { low, high };

  // Latest values for the gesture handlers (created once), refreshed after every render.
  const liveRef = useRef(live);
  const dragRef = useRef<Thumbs | null>(null);
  const startFraction = useRef(0);
  const widthRef = useRef(width);
  const domainRef = useRef(domain);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    liveRef.current = live;
    widthRef.current = width;
    domainRef.current = domain;
    commitRef.current = onCommit;
  });

  const responder = useMemo(() => {
    const make = (which: 'low' | 'high') =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startFraction.current = valueToFraction(liveRef.current[which], domainRef.current);
          dragRef.current = liveRef.current;
          setDrag(liveRef.current);
        },
        onPanResponderMove: (_e, g) => {
          const usable = Math.max(1, widthRef.current - THUMB);
          const next = moveThumb(dragRef.current ?? liveRef.current, which, fractionToValue(startFraction.current + g.dx / usable, domainRef.current), domainRef.current);
          dragRef.current = next;
          setDrag(next);
        },
        onPanResponderRelease: () => {
          if (dragRef.current) commitRef.current(dragRef.current);
          dragRef.current = null;
          setDrag(null);
        },
        onPanResponderTerminate: () => {
          dragRef.current = null;
          setDrag(null);
        },
      });
    return { low: make('low'), high: make('high') };
  }, []);

  const usable = Math.max(0, width - THUMB);
  const lowX = valueToFraction(live.low, domain) * usable;
  const highX = valueToFraction(live.high, domain) * usable;
  const step = (which: 'low' | 'high', dir: 1 | -1) => onCommit(moveThumb(live, which, live[which] + dir * domain.step, domain));

  const thumb = (which: 'low' | 'high', x: number) => (
    <View
      {...responder[which].panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={which === 'low' ? 'Minimum budget' : 'Maximum budget'}
      accessibilityValue={{ min: domain.min, max: domain.max, now: live[which] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(which, e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.touch, { left: x + THUMB / 2 - TOUCH / 2 }]}>
      <View style={styles.thumb} />
    </View>
  );

  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.track} />
      <View style={[styles.active, { left: lowX + THUMB / 2, width: Math.max(0, highX - lowX) }]} />
      {thumb('low', lowX)}
      {thumb('high', highX)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: TOUCH, justifyContent: 'center' },
  track: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: colors.border },
  active: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.primary },
  touch: { position: 'absolute', width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.primary },
});
