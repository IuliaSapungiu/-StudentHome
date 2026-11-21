// The decisions behind a swipe-to-reveal row, kept pure so they can be tested.

/** Minimum horizontal travel before a touch counts as a swipe at all (pixels). */
export const SWIPE_START_DISTANCE = 10;
/** How much more horizontal than vertical the movement must be. A mostly vertical drag is a scroll and is left alone. */
export const SWIPE_DOMINANCE = 1.6;

export const isHorizontalSwipe = (dx: number, dy: number): boolean => Math.abs(dx) > SWIPE_START_DISTANCE && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE;

/**
 * Which way the finger moves to reveal the actions. 'right' (the default) is used by the conversation rows in the Messages
 * list. 'left' is used where a right swipe would collide with the screen's back gesture: single messages in a chat and
 * notification rows. Everything below works on "progress" (how far the row is opened, 0 = closed), so both directions
 * share the same rules; the component turns progress into a left or right shift with `shiftFor`.
 */
export type SwipeDirection = 'left' | 'right';
const sign = (direction: SwipeDirection): 1 | -1 => (direction === 'left' ? -1 : 1);

/** How far the row sits open while dragging: between closed (0) and fully open (+ a little overshoot). Only in the opening direction. */
export const dragOffset = (wasOpen: boolean, dx: number, openWidth: number, direction: SwipeDirection = 'right'): number =>
  Math.max(0, Math.min(openWidth + 16, (wasOpen ? openWidth : 0) + dx * sign(direction)));

/** After the finger lifts: a quick flick decides, otherwise the row opens when pulled past 40% of its actions. */
export function shouldOpenAfterRelease(wasOpen: boolean, dx: number, vx: number, openWidth: number, direction: SwipeDirection = 'right'): boolean {
  const toward = dx * sign(direction);
  const speed = vx * sign(direction);
  if (speed > 0.4) return true;
  if (speed < -0.4) return false;
  return (wasOpen ? openWidth : 0) + toward > openWidth * 0.4;
}

/** The horizontal shift to give the row for a given progress: rightwards for 'right', leftwards for 'left'. */
export const shiftFor = (progress: number, direction: SwipeDirection = 'right'): number => progress * sign(direction);

/**
 * Whether a row should take over a drag. Any clearly horizontal drag for a row that swipes RIGHT (as before). A row that
 * swipes LEFT takes a closed row's drag only when it moves LEFT, so a swipe to the right (the screen's back gesture) is
 * never captured by it. An open row accepts both directions, so it can be closed again.
 */
export const claimsSwipe = (wasOpen: boolean, dx: number, dy: number, direction: SwipeDirection = 'right'): boolean =>
  isHorizontalSwipe(dx, dy) && (direction === 'right' || wasOpen || dx < 0);
