// Small ISO-date (YYYY-MM-DD) helpers. Pure and deterministic: "today" is always passed in.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** True only for real calendar dates such as 2026-02-28 (not 2026-02-31, not 26-1-1). */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** The device-local calendar date of `d` as YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-time Date for a valid ISO date (noon, to stay clear of daylight-saving edges). */
export function fromIsoDate(iso: string): Date {
  const m = ISO.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

/** "2026-11-01" -> "1 Nov 2026". Returns the input unchanged if it is not a valid date. */
export function formatIsoDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
