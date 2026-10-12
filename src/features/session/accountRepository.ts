import type { MockUser } from './types';

/**
 * Where accounts and the current-session pointer are kept. Screens never touch this directly;
 * they use useSession(). A Supabase implementation (Auth + profiles table) replaces the mock later.
 */
export interface AccountRepository {
  list(): Promise<MockUser[]>;
  /** Inserts or updates by id and returns the stored (normalised) user. */
  save(user: MockUser): Promise<MockUser>;
  replaceAll(accounts: MockUser[]): Promise<void>;
  getSessionUserId(): Promise<string | null>;
  setSessionUserId(id: string | null): Promise<void>;
}
