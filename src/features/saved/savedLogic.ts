// "Saved homes" rules. Pure. Persistence sits behind SavedRepository (Step 3c); the in-memory state in
// SavedProvider is just the loaded copy.

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

/** Idempotent version of toggleSaved: makes the property saved (or not saved) and never duplicates it. */
export function setSaved(state: SavedByUser, userId: string, propertyId: string, saved: boolean): SavedByUser {
  const current = state[userId] ?? [];
  const has = current.includes(propertyId);
  if (saved === has) return state;
  return { ...state, [userId]: saved ? [propertyId, ...current] : current.filter((id) => id !== propertyId) };
}
