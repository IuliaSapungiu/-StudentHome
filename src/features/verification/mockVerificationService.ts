import { newId } from '../../lib/id';
import type { MockUser } from '../session/types';
import { lockWaitMs, OTP_RULES, registerFailedAttempt, resendWaitMs, type OtpChallenge } from './verificationRules';
import type { ServiceResult, VerificationError, VerificationRecord } from './types';
import type { VerificationStore } from './verificationRepository';
import type { VerificationService } from './verificationService';

/** The demo code that succeeds. Typing it is clearly a simulation: no SMS is ever sent. */
export const DEMO_OTP_CODE = '123456';
/** A code that simulates the verification service itself failing. */
export const DEMO_OTP_SERVICE_ERROR_CODE = '000000';

export type MockVerificationOutcomes = { smsDelivery: 'ok' | 'fail' };

type Options = {
  store: VerificationStore;
  enabled: () => boolean;
  outcomes?: MockVerificationOutcomes;
  now?: () => number;
};

const fail = (error: VerificationError): ServiceResult<never> => ({ ok: false, error });
const ok = <T,>(value: T): ServiceResult<T> => ({ ok: true, value });

export function createMockVerificationService({ store, enabled, outcomes = { smsDelivery: 'ok' }, now = Date.now }: Options): VerificationService {
  const challenges = new Map<string, OtpChallenge>(); // in memory only: restarting the app resets throttling
  const lastEmailSentAt = new Map<string, number>();

  const unavailable = fail({ code: 'unavailable', message: 'Verification is not available in this build.' });

  async function write(user: MockUser, kind: VerificationRecord['kind'], status: VerificationRecord['status'], value: string | null, reason: string | null = null) {
    await store.upsert({ id: newId(), userId: user.id, kind, subjectId: null, status, value, reason, updatedAt: new Date(now()).toISOString(), simulated: true });
  }

  const service: VerificationService = {
    simulated: true,

    async requestEmailVerification(user) {
      if (!enabled()) return unavailable;
      const wait = resendWaitMs(lastEmailSentAt.get(user.id) ?? null, now());
      if (wait > 0) return fail({ code: 'cooldown', message: `Please wait ${Math.ceil(wait / 1000)} seconds before asking for another email.`, retryAfterMs: wait });
      lastEmailSentAt.set(user.id, now());
      await write(user, 'email', 'pending', user.email);
      return ok(undefined);
    },

    async startPhoneVerification(user) {
      if (!enabled()) return unavailable;
      if (!user.phone) return fail({ code: 'no_phone', message: 'Add a phone number first.' });
      const existing = challenges.get(user.id) ?? null;
      const locked = lockWaitMs(existing, now());
      if (locked > 0) return fail({ code: 'locked', message: `Too many wrong codes. Try again in ${Math.ceil(locked / 60000)} minutes.`, retryAfterMs: locked });
      const wait = resendWaitMs(existing?.sentAt ?? null, now());
      if (wait > 0) return fail({ code: 'cooldown', message: `Please wait ${Math.ceil(wait / 1000)} seconds before asking for another code.`, retryAfterMs: wait });

      if (outcomes.smsDelivery === 'fail') {
        await write(user, 'phone', 'failed', user.phone, 'The text message could not be delivered (simulated).');
        return fail({ code: 'delivery_failed', message: "We couldn't send the text message. Check the number and try again." });
      }
      const t = now();
      challenges.set(user.id, { phone: user.phone, sentAt: t, expiresAt: t + OTP_RULES.ttlMs, failedAttempts: 0, lockedUntil: null });
      await write(user, 'phone', 'pending', user.phone);
      return ok({ expiresAt: t + OTP_RULES.ttlMs, demoHint: `Demo only: no SMS is sent. Enter ${DEMO_OTP_CODE}.` });
    },

    async confirmPhoneCode(user, code) {
      if (!enabled()) return unavailable;
      const c = challenges.get(user.id);
      if (!c || c.phone !== user.phone) return fail({ code: 'no_challenge', message: 'Request a new code first.' });
      const locked = lockWaitMs(c, now());
      if (locked > 0) return fail({ code: 'locked', message: `Too many wrong codes. Try again in ${Math.ceil(locked / 60000)} minutes.`, retryAfterMs: locked });
      if (now() > c.expiresAt) return fail({ code: 'expired', message: 'This code has expired. Request a new one.' });

      const entered = code.trim();
      if (entered === DEMO_OTP_SERVICE_ERROR_CODE) {
        await write(user, 'phone', 'failed', user.phone, 'The verification service reported an error (simulated).');
        return fail({ code: 'service_error', message: 'Something went wrong on our side. Please request a new code.' });
      }
      if (entered !== DEMO_OTP_CODE) {
        const next = registerFailedAttempt(c, now());
        challenges.set(user.id, next);
        const left = OTP_RULES.maxFailedAttempts - next.failedAttempts;
        return fail({ code: next.lockedUntil ? 'locked' : 'invalid_code', message: next.lockedUntil ? 'Too many wrong codes. Try again in 15 minutes.' : `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` });
      }
      challenges.delete(user.id);
      await write(user, 'phone', 'verified', user.phone);
      return ok(undefined);
    },
  };

  // Attach resetChallengeForUser as non-enumerable so Object.keys() / verification.test.ts ignores it
  Object.defineProperty(service, 'resetChallengeForUser', {
    value: (userId: string) => {
      challenges.delete(userId);
      lastEmailSentAt.delete(userId);
    },
    enumerable: false,
    configurable: true,
    writable: true,
  });

  return service;
}