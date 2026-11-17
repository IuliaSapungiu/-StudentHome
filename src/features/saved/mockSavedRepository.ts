import type { MockStorage } from '../../storage/keyValue';
import { createCollectionStore } from '../shared/collectionStore';
import { isRecord, asString } from '../shared/parse';
import { savedIdsFor, setSaved, type SavedByUser } from './savedLogic';
import type { SavedRepository } from './savedRepository';

type Row = { userId: string; propertyIds: string[] };

const parseRow = (raw: unknown): Row | null => {
  if (!isRecord(raw)) return null;
  const userId = asString(raw.userId);
  if (!userId || !Array.isArray(raw.propertyIds)) return null;
  const ids = raw.propertyIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return { userId, propertyIds: [...new Set(ids)] };
};

// One row per account, shaped like the future favourites table. Saved homes of different accounts never mix.
export function createMockSavedRepository(storage: MockStorage): SavedRepository {
  const store = createCollectionStore<Row>(storage, 'saved', parseRow);
  return {
    async list(userId) {
      return (await store.all()).find((r) => r.userId === userId)?.propertyIds ?? [];
    },
    set(userId, propertyId, saved) {
      return store.update((rows) => {
        const state: SavedByUser = Object.fromEntries(rows.map((r) => [r.userId, r.propertyIds]));
        const next = setSaved(state, userId, propertyId, saved);
        const ids = savedIdsFor(next, userId);
        const others = rows.filter((r) => r.userId !== userId);
        return { rows: ids.length > 0 ? [...others, { userId, propertyIds: ids }] : others, result: ids };
      });
    },
  };
}
