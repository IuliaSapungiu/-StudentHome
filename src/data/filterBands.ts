// Choices for the "Distance to university" and "Bathrooms" filters, and the one rule for what each choice means.
// Both the Filters screen (labels, options) and the filtering function (matching) read from here, so the meaning of
// a choice is defined exactly once. Pure: no React, React Native or storage.
//
// Several choices in the same filter are combined with OR ("up to 15 minutes OR 16-30 minutes").
// The bands do not overlap, so every choice adds homes and none of them is redundant.

/** Minutes to the nearest university. */
export type DistanceBand = 'within_15' | 'within_30';
export const DISTANCE_BANDS: readonly DistanceBand[] = ['within_15', 'within_30'];
export const DISTANCE_BAND_LABEL: Record<DistanceBand, string> = { within_15: 'Up to 15 min', within_30: '16–30 min' };

/** Number of bathrooms: exactly one, or two and more. */
export type BathroomBand = 'one' | 'two_plus';
export const BATHROOM_BANDS: readonly BathroomBand[] = ['one', 'two_plus'];
export const BATHROOM_BAND_LABEL: Record<BathroomBand, string> = { one: '1', two_plus: '2+' };

export function matchesDistanceBand(minutes: number, band: DistanceBand): boolean {
  switch (band) {
    case 'within_15':
      return minutes <= 15;
    case 'within_30':
      return minutes > 15 && minutes <= 30;
  }
}

export function matchesBathroomBand(bathrooms: number, band: BathroomBand): boolean {
  return band === 'one' ? bathrooms === 1 : bathrooms >= 2;
}
