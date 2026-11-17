/**
 * In-app notifications (local/demo only: there is no push, email or SMS delivery). One shared model for every
 * kind, so adding a new kind later means adding a value here and a builder in notificationLogic.ts.
 * Supabase: a `notifications` table with RLS "recipient only" (see docs/supabase-migration.md).
 */
export type NotificationKind =
  | 'viewing_confirmed'
  | 'viewing_alternative_proposed'
  | 'viewing_declined'
  | 'viewing_completed'
  | 'application_under_review'
  | 'application_accepted'
  | 'application_rejected';

export const NOTIFICATION_KINDS: NotificationKind[] = [
  'viewing_confirmed', 'viewing_alternative_proposed', 'viewing_declined', 'viewing_completed',
  'application_under_review', 'application_accepted', 'application_rejected',
];

export type NotificationEntityType = 'viewing' | 'application';

export type AppNotification = {
  /** Stable and deterministic: `ntf:<recipient>:<eventId>`. The same event can never produce two notifications. */
  id: string;
  /** The recipient's stable account id. A notification belongs to exactly one account. */
  userId: string;
  kind: NotificationKind;
  entityType: NotificationEntityType;
  /** The viewing request or application this is about. */
  entityId: string;
  propertyId: string;
  /** The home's title at the time, for display only. */
  propertyTitle: string;
  /** The id of the history event that caused it (viewing event id or application status id). */
  eventId: string;
  title: string;
  body: string;
  /** True when the student has something to decide (for example accept or reject a proposed time). */
  actionRequired: boolean;
  createdAt: string; // ISO UTC
  readAt: string | null;
  /**
   * Set when the recipient deleted it. The row is kept as a tombstone so the same event, if it is processed again,
   * is recognised and never recreates the notification. Deleted notifications are never listed. Deleting touches this
   * record only, never the viewing, application or conversation it was about.
   */
  deletedAt: string | null;
  /** True when a demo responder acted as the landlord. */
  simulated: boolean;
};

/** What a producer (a repository, later a database trigger) hands over. The id and timestamps are added on record. */
export type NewNotification = Omit<AppNotification, 'id' | 'createdAt' | 'readAt' | 'deletedAt'>;

/** Where tapping a notification leads. Resolved from the entity, so no screen path is stored. */
export type NotificationTarget = { screen: 'viewing'; viewingId: string } | { screen: 'application'; applicationId: string };
