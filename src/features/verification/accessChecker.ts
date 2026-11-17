import type { MockUser } from '../session/types';
import type { VerificationRecord } from './types';
import { getAccessDecision, type AccessDecision, type GatedAction } from './verificationRules';

/**
 * Decides, for an account id, whether an action is allowed - using the SAME rules the screens use
 * (getAccessDecision). The Step 3c repositories call it themselves, so the verification gates are enforced
 * where the data is written, as they must be on a server, and not only in the UI.
 */
export type AccessChecker = (userId: string, action: GatedAction) => Promise<AccessDecision>;

export function createAccessChecker(deps: {
  getUser: (userId: string) => Promise<MockUser | null>;
  listRecords: (userId: string) => Promise<VerificationRecord[]>;
}): AccessChecker {
  return async (userId, action) => {
    const user = await deps.getUser(userId);
    const records = user ? await deps.listRecords(userId) : [];
    return getAccessDecision(action, { user, records });
  };
}
