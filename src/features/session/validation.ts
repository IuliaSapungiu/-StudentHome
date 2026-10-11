// Returns an error message, or null when the value is acceptable.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (!EMAIL.test(v)) return 'Enter a valid email address.';
  return null;
}

/** For creating an account. */
export function validateNewPassword(value: string): string | null {
  if (!value) return 'Create a password.';
  if (value.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

/** For logging in: the prototype only checks that something was entered (it is never verified). */
export function validateLoginPassword(value: string): string | null {
  return value ? null : 'Enter your password.';
}
