// React-Native-free pieces of the mock persistence layer, so they can be unit tested in Node.

/** The tiny subset of AsyncStorage the mock layer needs. */
export interface KeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const MOCK_NAMESPACE = 'studenthouse.mock.v1.';

export type MockStorage = {
  read<T>(key: string, parse: (raw: unknown) => T | null): Promise<T | null>;
  write(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
};

export function createMockStorage(kv: KeyValue): MockStorage {
  return {
    async read(key, parse) {
      try {
        const raw = await kv.getItem(MOCK_NAMESPACE + key);
        return raw === null ? null : parse(JSON.parse(raw));
      } catch {
        return null; // missing, corrupted or unreadable data behaves like "nothing stored"
      }
    },
    async write(key, value) {
      try {
        await kv.setItem(MOCK_NAMESPACE + key, JSON.stringify(value));
      } catch {
        // best effort: the prototype keeps working in memory
      }
    },
    async remove(key) {
      try {
        await kv.removeItem(MOCK_NAMESPACE + key);
      } catch {}
    },
  };
}

/** In-memory KeyValue for tests. */
export function createMemoryKeyValue(initial: Record<string, string> = {}): KeyValue & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    async getItem(k) {
      return data.has(k) ? (data.get(k) as string) : null;
    },
    async setItem(k, v) {
      data.set(k, v);
    },
    async removeItem(k) {
      data.delete(k);
    },
    dump: () => Object.fromEntries(data),
  };
}
