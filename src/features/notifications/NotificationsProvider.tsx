import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { notificationRepository as defaultRepository } from '@/services';
import { useSession } from '../session/SessionProvider';
import { unreadNotificationCount } from './notificationLogic';
import type { NotificationRepository } from './notificationRepository';
import type { AppNotification, NotificationEntityType } from './types';

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  ready: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Marks the unread notifications about exactly this viewing/application as read (call when the student opens it). */
  markEntityRead: (entityType: NotificationEntityType, entityId: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// The signed-in account's in-app notifications. Local to this device while the app uses mock data.
export function NotificationsProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: NotificationRepository }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setReady(false);
      return;
    }
    setNotifications(await repository.list(userId));
    setReady(true);
  }, [repository, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      await repository.markRead(userId, id);
      await refresh();
    },
    [repository, userId, refresh],
  );
  const markEntityRead = useCallback(
    async (entityType: NotificationEntityType, entityId: string) => {
      if (!userId) return;
      const changed = await repository.markEntityRead(userId, entityType, entityId);
      if (changed > 0) await refresh(); // nothing to show when nothing was unread
    },
    [repository, userId, refresh],
  );
  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await repository.markAllRead(userId);
    await refresh();
  }, [repository, userId, refresh]);

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!userId) return;
      await repository.delete(userId, id);
      await refresh();
    },
    [repository, userId, refresh],
  );
  const deleteAll = useCallback(async () => {
    if (!userId) return;
    await repository.deleteAll(userId);
    await refresh();
  }, [repository, userId, refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount: unreadNotificationCount(notifications), ready, refresh, markRead, markAllRead, markEntityRead, deleteNotification, deleteAll }),
    [notifications, ready, refresh, markRead, markAllRead, markEntityRead, deleteNotification, deleteAll],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
