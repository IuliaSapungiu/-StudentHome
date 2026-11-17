// Month-grid helpers for the custom calendar. Pure: dates are 'YYYY-MM-DD' strings, weeks start on Monday.

export type YearMonth = { year: number; month: number }; // month 1-12

const pad = (n: number) => String(n).padStart(2, '0');
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const yearMonthOf = (isoDate: string): YearMonth => ({ year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)) });

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const compareYearMonth = (a: YearMonth, b: YearMonth): number => a.year * 12 + a.month - (b.year * 12 + b.month);

/** Weeks of 7 cells; days outside the month are null. */
export function monthGrid(ym: YearMonth): (string | null)[][] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const days = new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${ym.year}-${pad(ym.month)}-${pad(i + 1)}`)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
