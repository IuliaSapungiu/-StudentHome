// Shared fixtures for the Step 3c logic tests (not imported by app code).
import { createMemoryKeyValue, createMockStorage } from '../storage/keyValue';
import { createUser } from './session/sessionLogic';
import { createAccessChecker } from './verification/accessChecker';
import type { VerificationRecord } from './verification/types';
import type { MockUser } from './session/types';
import type { Property } from '../data/types';

export const PHONE = '+40712345678';

export function makeUser(id: string, phone: string | null = PHONE): MockUser {
  return createUser(`${id}@example.com`, 'student', id, { fullName: `Name ${id}`, phone });
}

export const verified = (user: MockUser, kind: 'email' | 'phone'): VerificationRecord => ({
  id: `${user.id}-${kind}`, userId: user.id, kind, subjectId: null, status: 'verified',
  value: kind === 'email' ? user.email : user.phone, reason: null, updatedAt: '2026-10-30T00:00:00.000Z', simulated: true,
});

export const makeProperty = (id: string, ownerId: string, over: Partial<Property> = {}): Property =>
  ({ id, ownerId, source: 'demo', status: 'published', planId: 'basic', title: `Home ${id}`, city: 'Bucharest', area: 'Center', ...over }) as Property;

/** A world with accounts, verification records and properties, and the checker built from them. */
export function makeWorld(users: MockUser[], records: VerificationRecord[], properties: Property[]) {
  const access = createAccessChecker({
    getUser: async (id) => users.find((u) => u.id === id) ?? null,
    listRecords: async (id) => records.filter((r) => r.userId === id),
  });
  const propertyRepo = { getById: async (id: string) => properties.find((p) => p.id === id && p.status === 'published') ?? null };
  const storage = createMockStorage(createMemoryKeyValue());
  let t = Date.UTC(2026, 9, 31, 10, 0, 0); // 2026-10-31 10:00 UTC
  const clock = { now: () => new Date(t), advanceMinutes: (m: number) => (t += m * 60000), set: (d: Date) => (t = d.getTime()) };
  let n = 0;
  const newId = () => `id-${++n}`;
  return { access, propertyRepo, storage, clock, newId, users, records, properties };
}

import { createMockApplicationRepository, createApplicationStore } from './applications/mockApplicationRepository';
import { createMessagingStores, createMockConversationRepository } from './messaging/mockConversationRepository';
import { createMockNotificationRepository, createNotificationStore } from './notifications/mockNotificationRepository';
import { createMockViewingRepository, createViewingStore } from './viewings/mockViewingRepository';

/** Every Step 3c repository wired together over one shared world (the same way the services root wires them). */
export function makeStack(w: ReturnType<typeof makeWorld>, addresses: Record<string, string> = {}) {
  const stores = createMessagingStores(w.storage);
  const notificationStore = createNotificationStore(w.storage);
  const notifications = createMockNotificationRepository({ store: notificationStore, now: w.clock.now });
  const conversations = createMockConversationRepository({ stores, properties: w.propertyRepo, access: w.access, now: w.clock.now, newId: w.newId });
  const viewingStore = createViewingStore(w.storage);
  const viewings = createMockViewingRepository({ store: viewingStore, properties: w.propertyRepo, access: w.access, events: conversations, notifications, addresses: (id) => addresses[id] ?? null, now: w.clock.now, newId: w.newId });
  const applicationStore = createApplicationStore(w.storage);
  const applications = createMockApplicationRepository({ store: applicationStore, properties: w.propertyRepo, access: w.access, getUser: async (id) => w.users.find((u) => u.id === id) ?? null, notifications, now: w.clock.now, newId: w.newId });
  return { stores, conversations, viewings, viewingStore, applications, applicationStore, notifications, notificationStore };
}
