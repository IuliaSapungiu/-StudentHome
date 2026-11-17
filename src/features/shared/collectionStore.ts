import type { MockStorage } from '../../storage/keyValue';

/**
 * A mock table: a list of rows persisted under one storage key (shaped like a future database table).
 * Updates are serialised, so two quick taps cannot overwrite each other with a stale copy.
 */
export interface CollectionStore<T> {
  all(): Promise<T[]>;
  /** Runs `fn` on the current rows; saves the rows it returns and gives back its result. */
  update<R>(fn: (rows: T[]) => { rows: T[]; result: R }): Promise<R>;
}

export function createCollectionStore<T>(storage: MockStorage, key: string, parseRow: (raw: unknown) => T | null): CollectionStore<T> {
  const parseAll = (raw: unknown): T[] | null => (Array.isArray(raw) ? raw.map(parseRow).filter((r): r is T => r !== null) : null);
  const read = async () => (await storage.read(key, parseAll)) ?? [];
  let queue: Promise<unknown> = Promise.resolve();
  return {
    all: () => queue.then(read, read) as Promise<T[]>,
    update<R>(fn: (rows: T[]) => { rows: T[]; result: R }): Promise<R> {
      const run = async () => {
        const { rows, result } = fn(await read());
        await storage.write(key, rows);
        return result;
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
