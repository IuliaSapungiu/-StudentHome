import type { VerificationRecord } from './types';

/** What the app may do with verification data: read it. It cannot create or change statuses. */
export interface VerificationRepository {
  listForUser(userId: string): Promise<VerificationRecord[]>;
}

/** Internal write access, used only by the mock service and the demo simulator (never by screens). */
export interface VerificationStore extends VerificationRepository {
  upsert(record: VerificationRecord): Promise<void>;
  remove(userId: string, kind: VerificationRecord['kind'], subjectId: string | null): Promise<void>;
  removeForUser(userId: string): Promise<void>;
}
