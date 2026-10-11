// Pure layout rules (no React) so they are easy to reason about and test.
// Widths are in density-independent pixels (dp), as returned by useWindowDimensions().

export const breakpoints = {
  smallPhone: 360, // below this: compact spacing
  tablet: 600, // from here: tablet layout (most tablets in portrait, phones never)
  largeTablet: 900, // from here: three columns (tablet landscape, large tablets)
} as const;

export type DeviceClass = 'phone' | 'tablet';

export type Layout = {
  deviceClass: DeviceClass;
  isSmallPhone: boolean;
  /** Number of columns for property grids. */
  columns: 1 | 2 | 3;
  /** Horizontal page padding. */
  gutter: number;
  /** Gap between grid items / horizontal cards. */
  gap: number;
  /** Max width of page content; content is centred beyond this on large screens. */
  contentMaxWidth: number;
  /** Width of one item when a list is laid out as a grid (one full-width item on phones). */
  gridItemWidth: number;
  /** Width of a card in a horizontal carousel. */
  carouselCardWidth: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function getLayout(width: number): Layout {
  const isTablet = width >= breakpoints.tablet;
  const isSmallPhone = width < breakpoints.smallPhone;
  const columns = width >= breakpoints.largeTablet ? 3 : isTablet ? 2 : 1;
  const gutter = isTablet ? 32 : isSmallPhone ? 16 : 24;
  const gap = isTablet ? 24 : 16;
  const contentMaxWidth = 1100;
  const usable = Math.min(width, contentMaxWidth) - gutter * 2;
  const gridItemWidth = Math.floor((usable - gap * (columns - 1)) / columns);

  return {
    deviceClass: isTablet ? 'tablet' : 'phone',
    isSmallPhone,
    columns,
    gutter,
    gap,
    contentMaxWidth,
    gridItemWidth,
    // Phones: show most of one card and peek at the next. Tablets: fit `columns` cards.
    carouselCardWidth: isTablet ? gridItemWidth : clamp(Math.round(width * 0.78), 240, 340),
  };
}
