import type { MockUser } from '../session/types';
import type { ServiceResult } from './types';

/**
 * Commands that START or CONTINUE a verification. They never take a status as input: outcomes are
 * decided by the service (a trusted backend in production), so the client cannot grant itself
 * verification. The mock implementation is driven by the demo simulator and is clearly marked simulated.
 */
export interface VerificationService {
  /** True when outcomes are simulated and are not real-world verification. */
  readonly simulated: boolean;
  requestEmailVerification(user: MockUser): Promise<ServiceResult>;
  /** Sends an SMS code to user.phone. */
  startPhoneVerification(user: MockUser): Promise<ServiceResult<{ expiresAt: number; demoHint?: string }>>;
  confirmPhoneCode(user: MockUser, code: string): Promise<ServiceResult>;
}
