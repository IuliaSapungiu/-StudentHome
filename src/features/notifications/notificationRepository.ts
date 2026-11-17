import type { AppNotification, NewNotification } from './types';

/**
 * What a student can do with their own notifications. Every method is scoped to one account: nobody can read or
 * change another account's notifications. Supabase: `notifications` with RLS "recipient only".
 */
export interface NotificationRepository {
  /** Newest first. */
  list(userId: string): Promise<AppNotification[]>;
  /** Returns false when the notification does not exist or belongs to someone else. */
  markRead(userId: string, notificationId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  /** Deletes one of the caller's own notifications. False when it does not exist, is already deleted, or is someone else's. */
  delete(userId: string, notificationId: string): Promise<boolean>;
  /** Deletes all of the caller's own notifications (nobody else's). Returns how many. */
  deleteAll(userId: string): Promise<number>;
}

/**
 * What producers (the viewing and application repositories; later a database trigger) use. Idempotent: recording
 * the same event twice stores one notification and reports `created: false` the second time, also when the
 * recipient has deleted the first one (a deleted notification is not recreated).
 */
export interface NotificationSink {
  record(n: NewNotification): Promise<{ created: boolean; notification: AppNotification }>;
}
