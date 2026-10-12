// FORMAT validation only. A well-formed number says nothing about whether it exists or whether the
// user controls it. Ownership is only established by an SMS code (see features/verification).

export type PhoneParseResult =
  | { ok: true; e164: string; kind: 'ro_mobile' | 'international' }
  | { ok: false; reason: 'empty' | 'invalid_characters' | 'missing_country_code' | 'ro_not_mobile' | 'invalid_length' };

/** Accepts Romanian mobile numbers (07xx xxx xxx, +40 7xx xxx xxx, 0040...) and other international E.164 numbers. */
export function parsePhone(input: string): PhoneParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (/[^\d+\s().-]/.test(trimmed)) return { ok: false, reason: 'invalid_characters' };

  let digits = trimmed.replace(/[\s().-]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);

  // Romanian national format: 07xxxxxxxx
  if (/^07\d{8}$/.test(digits)) return { ok: true, e164: '+40' + digits.slice(1), kind: 'ro_mobile' };
  if (!digits.startsWith('+')) return { ok: false, reason: digits.startsWith('0') ? 'ro_not_mobile' : 'missing_country_code' };
  if (!/^\+\d+$/.test(digits)) return { ok: false, reason: 'invalid_characters' };

  if (digits.startsWith('+40')) {
    const national = digits.slice(3);
    if (!/^7\d{8}$/.test(national)) {
      return { ok: false, reason: national.length === 9 ? 'ro_not_mobile' : 'invalid_length' };
    }
    return { ok: true, e164: digits, kind: 'ro_mobile' };
  }
  if (!/^\+[1-9]\d{7,14}$/.test(digits)) return { ok: false, reason: 'invalid_length' };
  return { ok: true, e164: digits, kind: 'international' };
}

const MESSAGES: Record<Extract<PhoneParseResult, { ok: false }>['reason'], string> = {
  empty: 'Enter your phone number.',
  invalid_characters: 'Use only digits, spaces and an optional + at the start.',
  missing_country_code: 'Add the country code, for example +44 for the UK.',
  ro_not_mobile: 'Romanian numbers must be mobile numbers starting with 07 or +40 7, so we can text you a code.',
  invalid_length: 'This phone number is not the right length. Check the digits and the country code.',
};

/** Returns an error message, or null when the format is acceptable. */
export function validatePhone(value: string): string | null {
  const result = parsePhone(value);
  return result.ok ? null : MESSAGES[result.reason];
}

/** The canonical E.164 form, or null if the format is invalid. */
export const normalizePhone = (value: string): string | null => {
  const r = parsePhone(value);
  return r.ok ? r.e164 : null;
};
