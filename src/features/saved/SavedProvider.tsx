import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSession } from '../session/SessionProvider';
import { useRequireAccount } from '../session/useRequireAccount';
import { isSaved as isSavedIn, toggleSaved, type SavedByUser } from './savedLogic';

// TEMPORARY (Step 3b): saved homes kept in memory for the running app session, so the heart looks
// the same on a Search card, a map preview and Property Detail. Nothing is persisted and there is
// no Saved screen yet; both arrive in a later step with a real repository.

type SavedContextValue = { saved: SavedByUser; userId: string | null; toggle: (propertyId: string) => void };

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [saved, setSaved] = useState<SavedByUser>({});
  const userId = user?.id ?? null;
  const toggle = useCallback(
    (propertyId: string) => {
      if (userId) setSaved((prev) => toggleSaved(prev, userId, propertyId));
    },
    [userId],
  );
  const value = useMemo(() => ({ saved, userId, toggle }), [saved, userId, toggle]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

/**
 * `isSaved(id)` for rendering hearts; `toggleSaved(id)` for pressing one. Guests who press a heart
 * are sent to the "Create an account" screen instead (existing guest rule), and nothing is saved.
 */
export function useSaved(): { isSaved: (propertyId: string) => boolean; toggleSaved: (propertyId: string) => void } {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>');
  const requireAccount = useRequireAccount();
  const { saved, userId, toggle } = ctx;
  return {
    isSaved: (propertyId) => isSavedIn(saved, userId, propertyId),
    toggleSaved: (propertyId) => {
      requireAccount(() => toggle(propertyId));
    },
  };
}
