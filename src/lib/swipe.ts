// The decisions behind a swipe-to-reveal row, kept pure so they can be tested.

/** Minimum horizontal travel before a touch counts as a swipe at all (pixels). */
export const SWIPE_START_DISTANCE = 10;
/** How much more horizontal than vertical the movement must be. A mostly vertical drag is a scroll and is left alone. */
export const SWIPE_DOMINANCE = 1.6;

export const isHorizontalSwipe = (dx: number, dy: number): boolean => Math.abs(dx) > SWIPE_START_DISTANCE && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE;

/** Where the row sits while dragging: between closed (0) and fully open (+ a little overshoot). Only rightwards. */
export const dragOffset = (wasOpen: boolean, dx: number, openWidth: number): number => Math.max(0, Math.min(openWidth + 16, (wasOpen ? openWidth : 0) + dx));

/** After the finger lifts: a quick flick decides, otherwise the row opens when pulled past 40% of its actions. */
export function shouldOpenAfterRelease(wasOpen: boolean, dx: number, vx: number, openWidth: number): boolean {
  if (vx > 0.4) return true;
  if (vx < -0.4) return false;
  return (wasOpen ? openWidth : 0) + dx > openWidth * 0.4;
}
