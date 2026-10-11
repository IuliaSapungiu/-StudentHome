import { readMock, removeMock, writeMock } from '../../storage/mockStorage';
import { parseUser } from './sessionLogic';
import type { MockUser } from './types';

const ACCOUNTS_KEY = 'accounts';
const SESSION_KEY = 'session';

const parseAccounts = (raw: unknown): MockUser[] | null =>
  Array.isArray(raw) ? raw.map(parseUser).filter((u): u is MockUser => u !== null) : null;

const parseSessionId = (raw: unknown): string | null => (typeof raw === 'string' ? raw : null);

export const loadAccounts = async () => (await readMock(ACCOUNTS_KEY, parseAccounts)) ?? [];
export const saveAccounts = (accounts: MockUser[]) => writeMock(ACCOUNTS_KEY, accounts);
export const loadSessionUserId = () => readMock(SESSION_KEY, parseSessionId);
export const saveSessionUserId = (id: string | null) => (id ? writeMock(SESSION_KEY, id) : removeMock(SESSION_KEY));
