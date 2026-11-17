import type { MockStorage } from '../../storage/keyValue';
import { createCollectionStore, type CollectionStore } from '../shared/collectionStore';
import { asIsoTimestamp, asString, isRecord, oneOf } from '../shared/parse';
import { notificationId, sortNotifications } from './notificationLogic';
import type { NotificationRepository, NotificationSink } from './notificationRepository';
import { NOTIFICATION_KINDS, type AppNotification } from './types';

export type NotificationStore = CollectionStore<AppNotification>;

const parseNotification = (raw: unknown): AppNotification | null => {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id), userId = asString(raw.userId), entityId = asString(raw.entityId), propertyId = asString(raw.propertyId), eventId = asString(raw.eventId);
  const kind = oneOf(NOTIFICATION_KINDS, raw.kind), entityType = oneOf(['viewing', 'application'] as const, raw.entityType), createdAt = asIsoTimestamp(raw.createdAt);
  const title = asString(raw.title), body = asString(raw.body);
  if (!id || !userId || !entityId || !propertyId || !eventId || !kind || !entityType || !createdAt || !title || !body) return null;
  return {
    id, userId, kind, entityType, entityId, propertyId, eventId, title, body, createdAt,
    propertyTitle: typeof raw.propertyTitle === 'string' ? raw.propertyTitle : '',
    actionRequired: raw.actionRequired === true,
    readAt: asIsoTimestamp(raw.readAt),
    deletedAt: asIsoTimestamp(raw.deletedAt),
    simulated: raw.simulated === true,
  };
};

export const createNotificationStore = (storage: MockStorage): NotificationStore => createCollectionStore(storage, 'notifications', parseNotification);

export function createMockNotificationRepository(deps: { store: NotificationStore; now?: () => Date }): NotificationRepository & NotificationSink {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  return {
    async list(userId) {
      return sortNotifications((await store.all()).filter((n) => n.userId === userId && n.deletedAt === null));
    },
    markRead(userId, id) {
      return store.update((rows) => {
        const target = rows.find((n) => n.id === id && n.userId === userId && n.deletedAt === null);
        if (!target) return { rows, result: false };
        if (target.readAt) return { rows, result: true };
        const at = now().toISOString();
        return { rows: rows.map((n) => (n === target ? { ...n, readAt: at } : n)), result: true };
      });
    },
    markAllRead(userId) {
      return store.update((rows) => {
        const at = now().toISOString();
        let count = 0;
        const next = rows.map((n) => (n.userId === userId && n.deletedAt === null && n.readAt === null ? (count++, { ...n, readAt: at }) : n));
        return { rows: next, result: count };
      });
    },
    delete(userId, id) {
      return store.update((rows) => {
        const target = rows.find((n) => n.id === id && n.userId === userId && n.deletedAt === null);
        if (!target) return { rows, result: false };
        const at = now().toISOString();
        return { rows: rows.map((n) => (n === target ? { ...n, deletedAt: at } : n)), result: true };
      });
    },
    deleteAll(userId) {
      return store.update((rows) => {
        const at = now().toISOString();
        let count = 0;
        const next = rows.map((n) => (n.userId === userId && n.deletedAt === null ? (count++, { ...n, deletedAt: at }) : n));
        return { rows: next, result: count };
      });
    },
    record(input) {
      const id = notificationId(input.userId, input.eventId);
      return store.update<{ created: boolean; notification: AppNotification }>((rows) => {
        const existing = rows.find((n) => n.id === id);
        if (existing) return { rows, result: { created: false, notification: existing } }; // includes deleted ones: never recreated
        const notification: AppNotification = { ...input, id, createdAt: now().toISOString(), readAt: null, deletedAt: null };
        return { rows: [...rows, notification], result: { created: true, notification } };
      });
    },
  };
}
