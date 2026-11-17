import type { AccessDecision } from '../verification/verificationRules';

// What the Step 3c repositories return instead of throwing, so screens can show a clear message.
export type RepoErrorCode =
  | 'not_allowed' // a verification gate refused (see `access`)
  | 'not_found' // missing, or not visible to this person
  | 'forbidden' // the person may not do this (for example: messaging their own listing)
  | 'invalid' // the input failed validation (see `fields` when per-field)
  | 'conflict' // the current state does not allow it (duplicate, wrong status)
  | 'unavailable' // the listing is not public
  | 'expired'; // a time limit has passed (for example editing a message after 20 minutes)

export type RepoError = {
  code: RepoErrorCode;
  message: string;
  /** Present when code is 'not_allowed': which verification step is missing. */
  access?: Exclude<AccessDecision, { allowed: true }>;
  /** Present for validation failures that belong to specific form fields. */
  fields?: Record<string, string>;
};

export type RepoResult<T> = { ok: true; value: T } | { ok: false; error: RepoError };

export const ok = <T>(value: T): RepoResult<T> => ({ ok: true, value });
export const fail = <T = never>(code: RepoErrorCode, message: string, extra: Partial<Pick<RepoError, 'access' | 'fields'>> = {}): RepoResult<T> => ({
  ok: false,
  error: { code, message, ...extra },
});
