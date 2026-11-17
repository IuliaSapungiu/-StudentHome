import { addDays } from './dateTime';

// ONE date range for every calendar in the app (viewing dates and move-in dates): from today to the same day
// two years later. It is computed from the clock each time it is asked for, so nothing in it is hard-coded to a
// month or a year, and the range moves forward as time passes. (The two-year limit is a technical sanity bound.)

export const DATE_HORIZON_YEARS = 2;

const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** The same calendar day `years` later; 29 February becomes 28 February in a non-leap year. */
export function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const year = y + years;
  return `${year}-${pad(m)}-${pad(Math.min(d, daysInMonth(year, m)))}`;
}

/** Earliest and latest day a calendar may offer, given today's date (YYYY-MM-DD). */
export function dateRange(todayIso: string): { min: string; max: string } {
  return { min: todayIso, max: addYears(todayIso, DATE_HORIZON_YEARS) };
}

export const isWithinDateRange = (isoDate: string, todayIso: string): boolean => {
  const { min, max } = dateRange(todayIso);
  return isoDate >= min && isoDate <= max;
};

export { addDays };
