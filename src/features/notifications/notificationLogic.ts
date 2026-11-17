import { describeStart } from '../viewings/viewingRules';
import type { ViewingHistoryEntry, ViewingRequest } from '../viewings/types';
import type { ApplicationHistoryEntry, RentalApplication } from '../applications/types';
import type { AppNotification, NewNotification, NotificationKind, NotificationTarget } from './types';

export const notificationId = (userId: string, eventId: string): string => `ntf:${userId}:${eventId}`;

const VIEWING_KINDS: Partial<Record<ViewingHistoryEntry['event'], NotificationKind>> = {
  confirmed: 'viewing_confirmed',
  alternative_proposed: 'viewing_alternative_proposed',
  declined: 'viewing_declined',
  completed: 'viewing_completed',
};

/**
 * A viewing event the STUDENT should hear about: only what the landlord did. The student's own actions
 * (request, reschedule, cancel, accept or reject a time) never notify the student about themselves.
 */
export function viewingNotification(v: ViewingRequest, entry: ViewingHistoryEntry, propertyTitle: string): NewNotification | null {
  const kind = entry.actorRole === 'owner' ? VIEWING_KINDS[entry.event] : undefined;
  if (!kind) return null;
  const when = entry.start ? describeStart(entry.start) : '';
  const text: Record<string, { title: string; body: string; action: boolean }> = {
    viewing_confirmed: { title: 'Viewing confirmed', body: `${propertyTitle}: ${when}.`, action: false },
    viewing_alternative_proposed: { title: 'New viewing time proposed', body: `${propertyTitle}: the landlord suggested ${when}. Accept or reject the new time.`, action: true },
    viewing_declined: { title: 'Viewing declined', body: `${propertyTitle}: the landlord could not offer that time.`, action: false },
    viewing_completed: { title: 'Viewing completed', body: `${propertyTitle}: marked as completed.`, action: false },
  };
  const t = text[kind];
  return { userId: v.studentId, kind, entityType: 'viewing', entityId: v.id, propertyId: v.propertyId, propertyTitle, eventId: entry.id, title: t.title, body: t.body, actionRequired: t.action, simulated: entry.simulated };
}

const APPLICATION_KINDS: Partial<Record<ApplicationHistoryEntry['status'], NotificationKind>> = {
  under_review: 'application_under_review',
  accepted: 'application_accepted',
  rejected: 'application_rejected',
};

/** Only landlord decisions notify. "Submitted" and "Withdrawn" are the student's own actions. */
export function applicationNotification(a: RentalApplication, entry: ApplicationHistoryEntry, propertyTitle: string): NewNotification | null {
  const kind = entry.actorRole === 'owner' ? APPLICATION_KINDS[entry.status] : undefined;
  if (!kind) return null;
  const text: Record<string, { title: string; body: string }> = {
    application_under_review: { title: 'Application under review', body: `${propertyTitle}: the landlord is reviewing your application.` },
    application_accepted: { title: 'Application accepted', body: `${propertyTitle}: the landlord is interested in going ahead. Nothing is reserved yet. You can continue in Messages.` },
    application_rejected: { title: 'Application rejected', body: `${propertyTitle}: the landlord decided not to go ahead.` },
  };
  const t = text[kind];
  return { userId: a.studentId, kind, entityType: 'application', entityId: a.id, propertyId: a.propertyId, propertyTitle, eventId: entry.id, title: t.title, body: t.body, actionRequired: false, simulated: entry.simulated };
}

export function notificationTarget(n: Pick<AppNotification, 'entityType' | 'entityId'>): NotificationTarget {
  return n.entityType === 'viewing' ? { screen: 'viewing', viewingId: n.entityId } : { screen: 'application', applicationId: n.entityId };
}

export const unreadNotificationCount = (list: AppNotification[]): number => list.filter((n) => n.readAt === null).length;
export const sortNotifications = (list: AppNotification[]): AppNotification[] => [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
