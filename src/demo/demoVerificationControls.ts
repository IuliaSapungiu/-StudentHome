import { newId } from '../lib/id';
import type { MockUser } from '../features/session/types';
import type { VerificationStore } from '../features/verification/verificationRepository';
import type { VerificationKind, VerificationStatus } from '../features/verification/types';

// DEMO ONLY. Writes SIMULATED verification records so every state can be tested without real
// documents, SMS or paid services. Every record it writes is flagged `simulated: true`.
// It refuses to do anything unless demo verification is enabled.
type Options = { store: VerificationStore; enabled: () => boolean; now?: () => number };

const REASONS: Partial<Record<VerificationStatus, string>> = {
  rejected: 'Rejected in the demo simulator. In production a reviewer or provider decides this.',
  failed: 'Failed in the demo simulator (simulated technical problem).',
  more_info_required: 'More information required (simulated). In production we would say exactly what is missing.',
};

export function createDemoVerificationControls({ store, enabled, now = Date.now }: Options) {
  return {
    async setStatus(
      userId: string,
      kind: VerificationKind,
      status: VerificationStatus,
      opts: { subjectId?: string | null; value?: string | null } = {},
    ): Promise<boolean> {
      if (!enabled()) return false;
      const subjectId = opts.subjectId ?? null;
      if (status === 'not_started') {
        await store.remove(userId, kind, subjectId);
        return true;
      }
      await store.upsert({
        id: newId(), userId, kind, subjectId, status,
        value: opts.value ?? null,
        reason: REASONS[status] ?? null,
        updatedAt: new Date(now()).toISOString(),
        simulated: true,
      });
      return true;
    },

    /** Simulates the user opening (or failing to open) the link in the verification email. */
    async completeEmail(user: MockUser, outcome: 'verified' | 'failed' = 'verified'): Promise<boolean> {
      return this.setStatus(user.id, 'email', outcome, { value: user.email });
    },

    /** Preset for demo accounts: email verified, phone not verified (so the first viewing request asks for an SMS code). */
    async seedDemoAccount(user: MockUser): Promise<boolean> {
      if (!enabled()) return false;
      await store.removeForUser(user.id);
      return this.setStatus(user.id, 'email', 'verified', { value: user.email });
    },

    async reset(userId: string): Promise<boolean> {
      if (!enabled()) return false;
      await store.removeForUser(userId);
      return true;
    },
  };
}
