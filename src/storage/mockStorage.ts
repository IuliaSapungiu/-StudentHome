import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMockStorage } from './keyValue';

// Temporary on-device persistence for the prototype (mock accounts, session, verification).
// It is deliberately separate from the property repository and from any future Supabase code.
// Never put passwords, tokens or payment details here.
export const mockStorage = createMockStorage(AsyncStorage);

// Kept for backward compatibility with Step 2 imports.
export const readMock = mockStorage.read;
export const writeMock = mockStorage.write;
export const removeMock = mockStorage.remove;
