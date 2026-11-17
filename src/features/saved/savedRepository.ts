/**
 * Where a student's saved (favourite) homes are kept. Saving is allowed for any signed-in account, even
 * before email verification. Most recently saved first. Supabase: a `favourites` table (user_id, property_id,
 * created_at) with RLS "own rows only".
 */
export interface SavedRepository {
  list(userId: string): Promise<string[]>;
  /** Idempotent. Returns the account's saved ids afterwards. */
  set(userId: string, propertyId: string, saved: boolean): Promise<string[]>;
}
