import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { dragOffset, isHorizontalSwipe, shouldOpenAfterRelease } from '@/lib/swipe';

export type SwipeAction = { key: string; label: string; tone: 'neutral' | 'danger' | 'primary'; onPress: () => void };

type Props = {
  /** Shown, in order, when the row is swiped to the right. */
  actions: SwipeAction[];
  /** False turns the gesture off (the row then behaves like a plain row). */
  enabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Must be opaque and match the screen behind the row, because the actions sit underneath the content. */
  backgroundColor?: string;
  children: ReactNode;
};

const ACTION_W = 84;
const TONES = { neutral: '#5F6B66', danger: '#D64545', primary: colors.primary };

/**
 * Swipe a row to the RIGHT to reveal labelled actions (built with PanResponder + Animated, no extra dependency; works
 * the same on iOS, Android and web). A swipe only starts when the movement is clearly horizontal, so normal vertical
 * scrolling is never taken over; once it has started the row keeps it. Screen readers get the same actions through
 * accessibility actions, since a swipe is not available to everyone.
 */
export function SwipeableRow({ actions, enabled = true, open, onOpenChange, backgroundColor = colors.surface, children }: Props) {
  const width = actions.length * ACTION_W;
  const x = useRef(new Animated.Value(0)).current;
  const openRef = useRef(open);
  const widthRef = useRef(width);
  const enabledRef = useRef(enabled);
  const onChange = useRef(onOpenChange);
  openRef.current = open;
  widthRef.current = width;
  enabledRef.current = enabled;
  onChange.current = onOpenChange;

  const settle = (toOpen: boolean) => Animated.spring(x, { toValue: toOpen ? widthRef.current : 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  useEffect(() => settle(open && enabled), [open, enabled, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const horizontal = (_: unknown, g: { dx: number; dy: number }) => enabledRef.current && isHorizontalSwipe(g.dx, g.dy);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: horizontal,
        onMoveShouldSetPanResponderCapture: horizontal,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          x.setValue(dragOffset(openRef.current, g.dx, widthRef.current));
        },
        onPanResponderRelease: (_, g) => {
          const shouldOpen = shouldOpenAfterRelease(openRef.current, g.dx, g.vx, widthRef.current);
          settle(shouldOpen);
          if (shouldOpen !== openRef.current) onChange.current(shouldOpen);
        },
        onPanResponderTerminate: () => settle(openRef.current),
      }),
    [x], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!enabled || actions.length === 0) return <View>{children}</View>;
  return (
    <View
      style={styles.wrap}
      accessible={false}
      accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.onPress()}>
      <View style={[styles.actions, { width }]}>
        {actions.map((a) => (
          <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.label} onPress={() => { onOpenChange(false); a.onPress(); }} style={[styles.action, { backgroundColor: TONES[a.tone] }]}>
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View style={{ backgroundColor, transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
        {open ? <Pressable accessibilityLabel="Close actions" style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  actions: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row' },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
