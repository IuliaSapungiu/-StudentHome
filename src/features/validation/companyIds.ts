// FORMAT validation only. A CUI/CIF or ONRC number that passes these checks is NOT proof that the
// company exists, that it is active, or that the person entering it may represent it.
// Company existence and representative authority are separate verification steps.

const CUI_KEY = [7, 5, 3, 2, 1, 7, 5, 3, 2];

/** Strips spaces, an optional "RO" VAT prefix, and uppercases. Returns digits only. */
export function normalizeCui(input: string): string {
  return input.toUpperCase().replace(/\s+/g, '').replace(/^RO/, '');
}

/** CUI/CIF: 2-10 digits with a control digit (the official checksum). */
export function isCuiFormatValid(input: string): boolean {
  const cui = normalizeCui(input);
  if (!/^\d{2,10}$/.test(cui)) return false;
  const padded = cui.padStart(10, '0');
  const body = padded.slice(0, 9);
  const control = Number(padded[9]);
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * CUI_KEY[i], 0);
  const expected = (sum * 10) % 11 === 10 ? 0 : (sum * 10) % 11;
  return expected === control;
}

export function validateCui(value: string): string | null {
  if (!value.trim()) return 'Enter the CUI/CIF.';
  return isCuiFormatValid(value) ? null : "This CUI/CIF doesn't look right. Check the digits (an RO prefix is optional).";
}

// Romanian county codes used in ONRC numbers: 01-40 (40 = Bucharest), 51 and 52.
const ONRC_COUNTY_OK = (n: number) => (n >= 1 && n <= 40) || n === 51 || n === 52;
const ONRC = /^([JFC])\s*(\d{1,2})\s*\/\s*(\d{1,6})\s*\/\s*(\d{4})$/i;

/** Classic Trade Registry format, e.g. J40/1234/2020. Returns the canonical form or null. */
export function normalizeOnrc(input: string, currentYear: number = new Date().getFullYear()): string | null {
  const m = ONRC.exec(input.trim());
  if (!m) return null;
  const county = Number(m[2]);
  const year = Number(m[4]);
  if (!ONRC_COUNTY_OK(county) || Number(m[3]) < 1 || year < 1990 || year > currentYear) return null;
  return `${m[1].toUpperCase()}${String(county).padStart(2, '0')}/${Number(m[3])}/${year}`;
}

export function validateOnrc(value: string): string | null {
  if (!value.trim()) return 'Enter the Trade Registry number.';
  return normalizeOnrc(value)
    ? null
    : 'Use the format J40/1234/2020 (J, F or C, county code, number, year).';
}
