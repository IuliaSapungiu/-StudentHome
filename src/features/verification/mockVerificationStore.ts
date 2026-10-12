import type { MockStorage } from '../../storage/keyValue';
import { VERIFICATION_KINDS, VERIFICATION_STATUSES, type VerificationRecord } from './types';
import type { VerificationStore } from './verificationRepository';

const KEY = 'verification';

const parseRecord = (v: unknown): VerificationRecord | null => {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.userId !== 'string' || typeof r.updatedAt !== 'string') return null;
  if (!VERIFICATION_KINDS.includes(r.kind as never) || !VERIFICATION_STATUSES.includes(r.status as never)) return null;
  return {
    id: r.id,
    userId: r.userId,
    kind: r.kind as VerificationRecord['kind'],
    subjectId: typeof r.subjectId === 'string' ? r.subjectId : null,
    status: r.status as VerificationRecord['status'],
    value: typeof r.value === 'string' ? r.value : null,
    reason: typeof r.reason === 'string' ? r.reason : null,
    updatedAt: r.updatedAt,
    simulated: r.simulated === true,
  };
};

const parseAll = (raw: unknown): VerificationRecord[] | null =>
  Array.isArray(raw) ? raw.map(parseRecord).filter((r): r is VerificationRecord => r !== null) : null;

// Stored as one collection of rows shaped like a future `verification_records` table.
export function createMockVerificationStore(storage: MockStorage): VerificationStore {
  const all = async () => (await storage.read(KEY, parseAll)) ?? [];
  return {
    listForUser: async (userId) => (await all()).filter((r) => r.userId === userId),
    async upsert(record) {
      const others = (await all()).filter((r) => !(r.userId === record.userId && r.kind === record.kind && r.subjectId === record.subjectId));
      await storage.write(KEY, [...others, record]);
    },
    async remove(userId, kind, subjectId) {
      await storage.write(KEY, (await all()).filter((r) => !(r.userId === userId && r.kind === kind && r.subjectId === subjectId)));
    },
    async removeForUser(userId) {
      await storage.write(KEY, (await all()).filter((r) => r.userId !== userId));
    },
  };
}
