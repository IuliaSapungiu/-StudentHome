// Layout rules for the photo gallery, kept free of React so they can be tested.
//
// The gallery must never collapse. It used to take its HEIGHT from a measured width (height = width / ratio) and the width
// started at 0, so if the first measurement was late, lost, or reported as 0 while a screen was being pushed, the height
// stayed 0 and the photo AND its placeholder disappeared. Now the height comes from the layout engine (`aspectRatio`),
// which needs no measurement, and the measured width is only used to page the photos exactly.

/** The aspect ratio to give the gallery box: always a finite positive number (the default when given anything else). */
export const safeAspectRatio = (ratio: number | undefined, fallback = 1.4): number => (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0 ? ratio : fallback);

/** The next stored width after a measurement: a missing, zero, negative or non-finite one is IGNORED (keeps the previous). */
export function nextGalleryWidth(previous: number, measured: number): number {
  if (!Number.isFinite(measured)) return previous;
  const w = Math.round(measured);
  return w > 0 && w !== previous ? w : previous;
}

/** The pager (the swipeable list) needs a real width. Until it is known, the first photo is shown on its own. */
export const canRenderPager = (width: number): boolean => Number.isFinite(width) && width > 0;

/** The height of one page once the width is known, for the pager cells. */
export const pageHeight = (width: number, ratio: number): number => (canRenderPager(width) ? width / safeAspectRatio(ratio) : 0);
