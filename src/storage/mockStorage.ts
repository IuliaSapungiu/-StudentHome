import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary on-device persistence for the prototype (mock session, later provider drafts).
// It is deliberately separate from the property repository and from any future Supabase code.
// Never put passwords, tokens or payment details here.
const NAMESPACE = 'studenthouse.mock.v1.';

export async function readMock<T>(key: string, parse: (raw: unknown) => T | null): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(NAMESPACE + key);
    return raw === null ? null : parse(JSON.parse(raw));
  } catch {
    return null; // missing, corrupted or unreadable data behaves like "nothing stored"
  }
}

export async function writeMock(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(NAMESPACE + key, JSON.stringify(value));
  } catch {
    // best effort: the prototype keeps working in memory
  }
}

export async function removeMock(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(NAMESPACE + key);
  } catch {}
}
