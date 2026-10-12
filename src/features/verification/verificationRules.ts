import type { MockUser } from '../session/types';
import type { VerificationKind, VerificationRecord, VerificationStatus } from './types';

// ---- reading statuses --------------------------------------------------------------------------

export function findRecord(
  records: VerificationRecord[],
  userId: string,
  kind: VerificationKind,
  subjectId: string | null = null,
): VerificationRecord | undefined {
  return records.find((r) => r.userId === userId && r.kind === kind && r.subjectId === subjectId);
}

export function statusOf(records: VerificationRecord[], userId: string, kind: VerificationKind, subjectId: string | null = null): VerificationStatus {
  return findRecord(records, userId, kind, subjectId)?.status ?? 'not_started';
}

/**
 * The status to show for email or phone: a record only counts while it is about the account's CURRENT
 * address/number. After a change, the old record no longer applies and the status is "not started".
 */
export function effectiveContactStatus(records: VerificationRecord[], user: MockUser, kind: 'email' | 'phone'): VerificationStatus {
  const r = findRecord(records, user.id, kind);
  const current = kind === 'email' ? user.email : user.phone;
  return r && current !== null && r.value === current ? r.status : 'not_started';
}

/** Email counts as verified only for the address that was verified. */
export function isEmailVerified(records: VerificationRecord[], user: MockUser): boolean {
  const r = findRecord(records, user.id, 'email');
  return r?.status === 'verified' && r.value === user.email;
}

/**
 * Phone counts as verified only for the number that was verified. Changing the number therefore
 * requires verification again, with no extra stored flag to keep in sync.
 */
export function isPhoneVerified(records: VerificationRecord[], user: MockUser): boolean {
  const r = findRecord(records, user.id, 'phone');
  return user.phone !== null && r?.status === 'verified' && r.value === user.phone;
}

// ---- access gates ------------------------------------------------------------------------------

export type GatedAction = 'save' | 'message' | 'request_viewing' | 'rental_application';

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; requires: 'account' }
  | { allowed: false; requires: 'verified_email'; status: VerificationStatus }
  | { allowed: false; requires: 'verified_phone'; status: VerificationStatus; hasPhone: boolean };

/**
 * Who may do what (client-side UX only; production enforces the same rules in the backend):
 * - save: any account, even before email verification
 * - message: verified email
 * - request_viewing / rental_application: verified email, then an SMS-verified phone (first time only)
 */
export function getAccessDecision(
  action: GatedAction,
  ctx: { user: MockUser | null; records: VerificationRecord[] },
): AccessDecision {
  const { user, records } = ctx;
  if (!user) return { allowed: false, requires: 'account' };
  if (action === 'save') return { allowed: true };

  if (!isEmailVerified(records, user)) {
    return { allowed: false, requires: 'verified_email', status: statusOf(records, user.id, 'email') };
  }
  if (action === 'message') return { allowed: true };

  if (!isPhoneVerified(records, user)) {
    return { allowed: false, requires: 'verified_phone', status: statusOf(records, user.id, 'phone'), hasPhone: user.phone !== null };
  }
  return { allowed: true };
}

// ---- throttling (mirrors what the production SMS backend must enforce) -----------------------------

export const OTP_RULES = {
  codeLength: 6,
  ttlMs: 10 * 60 * 1000,
  resendCooldownMs: 30 * 1000,
  maxFailedAttempts: 5,
  lockMs: 15 * 60 * 1000,
} as const;

export type OtpChallenge = {
  phone: string;
  sentAt: number;
  expiresAt: number;
  failedAttempts: number;
  lockedUntil: number | null;
};

export const resendWaitMs = (lastSentAt: number | null, now: number) =>
  lastSentAt === null ? 0 : Math.max(0, lastSentAt + OTP_RULES.resendCooldownMs - now);

export const lockWaitMs = (c: OtpChallenge | null, now: number) => (c?.lockedUntil ? Math.max(0, c.lockedUntil - now) : 0);

export function registerFailedAttempt(c: OtpChallenge, now: number): OtpChallenge {
  const failedAttempts = c.failedAttempts + 1;
  return { ...c, failedAttempts, lockedUntil: failedAttempts >= OTP_RULES.maxFailedAttempts ? now + OTP_RULES.lockMs : c.lockedUntil };
}

// ---- wording -----------------------------------------------------------------------------------------

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
  failed: 'Failed',
  more_info_required: 'More information needed',
};

/** What the user should do next for a given status. */
export const STATUS_NEXT_STEP: Record<VerificationStatus, string> = {
  not_started: 'Start verification when you are ready.',
  pending: 'We are waiting for this to complete.',
  verified: 'Nothing more to do.',
  rejected: 'This was not accepted. Check your details and try again, or contact support.',
  failed: 'Something went wrong on our side. Please try again in a moment.',
  more_info_required: 'We need a little more information to finish. Follow the instructions we sent.',
};
