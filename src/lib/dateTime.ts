// Local wall-clock date-times for viewings, written 'YYYY-MM-DDTHH:mm' (no time zone). All demo listings are in
// Romania and the device is assumed to be in the listing's time zone; production stores timestamptz plus the
// property's time zone (see docs/supabase-migration.md). Pure and deterministic: "now" is always passed in.

export type LocalDateTime = string;

const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type ParsedLocal = { date: string; time: string; year: number; month: number; day: number; hour: number; minute: number };

export function parseLocalDateTime(value: unknown): ParsedLocal | null {
  if (typeof value !== 'string') return null;
  const m = RE.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  if (hour > 23 || minute > 59) return null;
  return { date: value.slice(0, 10), time: value.slice(11), year, month, day, hour, minute };
}

export const isLocalDateTime = (v: unknown): v is LocalDateTime => parseLocalDateTime(v) !== null;

export function toLocalDateTime(d: Date): LocalDateTime {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const localDate = (d: Date): string => toLocalDateTime(d).slice(0, 10);

/** Minutes since an arbitrary fixed origin; only differences are meaningful. */
export function toMinutes(v: LocalDateTime): number {
  const p = parseLocalDateTime(v);
  return p ? Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 60000 : Number.NaN;
}

export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addMinutes(v: LocalDateTime, n: number): LocalDateTime {
  const t = new Date(toMinutes(v) * 60000 + n * 60000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

export function weekdayName(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export const monthName = (month1: number): string => MONTHS[month1 - 1] ?? '';

/** "Thursday, 22 August" */
export function formatDateLong(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${weekdayName(isoDate)}, ${d} ${monthName(m)}`;
}

/** "Thursday, 22 August at 17:30" */
export const formatDateTimeLong = (v: LocalDateTime): string => `${formatDateLong(v.slice(0, 10))} at ${v.slice(11)}`;

// ---- instants (ISO UTC timestamps such as message times), shown in the device's local time -------------

export function formatClock(isoInstant: string): string {
  const d = new Date(isoInstant);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Today", "Yesterday", or "22 Aug" - used for chat day separators and list timestamps. */
export function dayLabel(isoInstant: string, now: Date): string {
  const d = new Date(isoInstant);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** List timestamp: the clock time for today, otherwise the day label. */
export const listStamp = (isoInstant: string, now: Date): string => (dayLabel(isoInstant, now) === 'Today' ? formatClock(isoInstant) : dayLabel(isoInstant, now));

/** "22 Aug · 17:30" - compact form for histories and cards. */
export function formatShortDateTime(v: LocalDateTime): string {
  const [, m, d] = v.slice(0, 10).split('-').map(Number);
  return `${d} ${monthName(m).slice(0, 3)} · ${v.slice(11)}`;
}
