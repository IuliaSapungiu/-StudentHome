import type { MockStorage } from '../../storage/keyValue';
import type { AccountRepository } from './accountRepository';
import { normalizeUser, parseUser } from './sessionLogic';
import type { MockUser } from './types';

// Same storage keys as Step 2 ("accounts" and "session" in the v1 namespace) so existing
// on-device accounts keep working. Passwords are never stored.
const ACCOUNTS_KEY = 'accounts';
const SESSION_KEY = 'session';

const parseAccounts = (raw: unknown): MockUser[] | null =>
  Array.isArray(raw) ? raw.map(parseUser).filter((u): u is MockUser => u !== null) : null;

const parseSessionId = (raw: unknown): string | null => (typeof raw === 'string' ? raw : null);

export function createMockAccountRepository(storage: MockStorage): AccountRepository {
  const list = async () => (await storage.read(ACCOUNTS_KEY, parseAccounts)) ?? [];
  return {
    list,
    async save(user) {
      const normalized = normalizeUser(user);
      const others = (await list()).filter((a) => a.id !== normalized.id);
      await storage.write(ACCOUNTS_KEY, [...others, normalized]);
      return normalized;
    },
    replaceAll: (accounts) => storage.write(ACCOUNTS_KEY, accounts.map(normalizeUser)),
    getSessionUserId: () => storage.read(SESSION_KEY, parseSessionId),
    setSessionUserId: (id) => (id ? storage.write(SESSION_KEY, id) : storage.remove(SESSION_KEY)),
  };
}
