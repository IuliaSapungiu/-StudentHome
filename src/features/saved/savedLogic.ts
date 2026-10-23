// Temporary, in-memory "saved homes" rules for Step 3b. Pure. Persistence and the Saved screen
// arrive in a later step; until then saved ids live only for the running app session.

/** user id -> saved property ids, most recently saved first. */
export type SavedByUser = Record<string, string[]>;

export const savedIdsFor = (state: SavedByUser, userId: string | null | undefined): string[] => (userId ? (state[userId] ?? []) : []);

export const isSaved = (state: SavedByUser, userId: string | null | undefined, propertyId: string): boolean =>
  savedIdsFor(state, userId).includes(propertyId);

/** Saves the property if it is not saved, removes it if it is. Never mutates the input. */
export function toggleSaved(state: SavedByUser, userId: string, propertyId: string): SavedByUser {
  const current = state[userId] ?? [];
  const next = current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [propertyId, ...current];
  return { ...state, [userId]: next };
}
