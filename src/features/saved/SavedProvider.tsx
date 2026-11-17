import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { savedRepository as defaultRepository } from '@/services';
import { useSession } from '../session/SessionProvider';
import { useRequireAccount } from '../session/useRequireAccount';
import { isSaved as isSavedIn, savedIdsFor, setSaved, type SavedByUser } from './savedLogic';
import type { SavedRepository } from './savedRepository';

// Saved homes, kept per account behind SavedRepository (persisted on this device while the app uses mock
// data). The state here is the loaded copy, so the heart looks the same on a Search card, a map preview,
// Home and Property Detail.

type SavedContextValue = { saved: SavedByUser; userId: string | null; ready: boolean; toggle: (propertyId: string) => void };

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: SavedRepository }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [saved, setSavedState] = useState<SavedByUser>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    repository.list(userId).then((ids) => {
      if (!alive) return;
      setSavedState((prev) => ({ ...prev, [userId]: ids }));
      setLoadedFor(userId);
    });
    return () => {
      alive = false;
    };
  }, [repository, userId]);

  const toggle = useCallback(
    (propertyId: string) => {
      if (!userId) return;
      const want = !isSavedIn(saved, userId, propertyId);
      setSavedState((prev) => setSaved(prev, userId, propertyId, want)); // instant heart
      repository.set(userId, propertyId, want).then((ids) => setSavedState((prev) => ({ ...prev, [userId]: ids })));
    },
    [repository, saved, userId],
  );

  const value = useMemo(() => ({ saved, userId, ready: userId !== null && loadedFor === userId, toggle }), [saved, userId, loadedFor, toggle]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

/**
 * `isSaved(id)` for rendering hearts; `toggleSaved(id)` for pressing one. Guests who press a heart
 * are sent to the "Create an account" screen instead (existing guest rule), and nothing is saved.
 * `savedIds` (most recent first), `count` and `ready` feed the Saved screen and the Profile row.
 */
export function useSaved(): {
  isSaved: (propertyId: string) => boolean;
  toggleSaved: (propertyId: string) => void;
  savedIds: string[];
  count: number;
  ready: boolean;
} {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>');
  const requireAccount = useRequireAccount();
  const { saved, userId, ready, toggle } = ctx;
  const savedIds = savedIdsFor(saved, userId);
  return {
    isSaved: (propertyId) => isSavedIn(saved, userId, propertyId),
    toggleSaved: (propertyId) => {
      requireAccount(() => toggle(propertyId));
    },
    savedIds,
    count: savedIds.length,
    ready,
  };
}
