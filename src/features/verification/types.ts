// Five distinct kinds of verification. Completing one never implies any other.
export type VerificationKind =
  | 'email'
  | 'phone'
  | 'identity'
  | 'company'
  | 'representative_authority'
  | 'property'; // right to let one specific property (subjectId = property id)

export type VerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'more_info_required';

export const VERIFICATION_KINDS: VerificationKind[] = ['email', 'phone', 'identity', 'company', 'representative_authority', 'property'];
export const VERIFICATION_STATUSES: VerificationStatus[] = ['not_started', 'pending', 'verified', 'rejected', 'failed', 'more_info_required'];

/**
 * One row per (user, kind, subject). Absence of a row means "not_started". Rows are written only by a
 * trusted VerificationService (a backend in production); the app can only read them.
 */
export type VerificationRecord = {
  id: string;
  userId: string;
  kind: VerificationKind;
  /** Property id for kind 'property'; null otherwise. */
  subjectId: string | null;
  status: VerificationStatus;
  /** The value this record is about (email address or E.164 phone). Verification only counts while it matches. */
  value: string | null;
  /** Human-readable reason for rejected / failed / more_info_required. */
  reason: string | null;
  updatedAt: string;
  /** True for records produced by the demo simulator. These are NOT real-world verification. */
  simulated: boolean;
};

export type VerificationErrorCode =
  | 'unavailable'
  | 'no_phone'
  | 'cooldown'
  | 'locked'
  | 'invalid_code'
  | 'expired'
  | 'no_challenge'
  | 'delivery_failed'
  | 'service_error';

export type VerificationError = { code: VerificationErrorCode; message: string; retryAfterMs?: number };
export type ServiceResult<T = void> = { ok: true; value: T } | { ok: false; error: VerificationError };
