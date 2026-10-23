// Pure layout rules (no React) so they are easy to reason about and test.
// Sizes are in density-independent pixels (dp), as returned by useWindowDimensions().
//
// The DEVICE CLASS comes from the SHORTEST side of the window (the Android "sw600dp" convention), so
// a phone turned to landscape is still a phone, while a tablet stays a tablet in either orientation
// (and a tablet in a narrow split-screen window is treated as a phone). The number of COLUMNS comes
// from the current WIDTH, because that is the room actually available.

export const breakpoints = {
  smallPhone: 360, // shortest side below this: compact spacing
  tablet: 600, // shortest side from here: tablet layout
  phoneTwoColumns: 700, // phones: two grid columns once the width allows (landscape)
  largeTablet: 900, // tablets: three columns from this width
} as const;

export type DeviceClass = 'phone' | 'tablet';

export type Layout = {
  deviceClass: DeviceClass;
  isLandscape: boolean;
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

export function getLayout(width: number, height: number = width): Layout {
  const shortest = Math.min(width, height);
  const isTablet = shortest >= breakpoints.tablet;
  const isSmallPhone = shortest < breakpoints.smallPhone;
  const columns: 1 | 2 | 3 = isTablet
    ? width >= breakpoints.largeTablet
      ? 3
      : 2
    : width >= breakpoints.phoneTwoColumns
      ? 2
      : 1;
  const gutter = isTablet ? 32 : isSmallPhone ? 16 : 24;
  const gap = isTablet ? 24 : 16;
  const contentMaxWidth = 1100;
  const usable = Math.min(width, contentMaxWidth) - gutter * 2;
  const gridItemWidth = Math.floor((usable - gap * (columns - 1)) / columns);

  return {
    deviceClass: isTablet ? 'tablet' : 'phone',
    isLandscape: width > height,
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
