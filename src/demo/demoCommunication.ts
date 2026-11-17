import { DEMO_PROPERTIES } from '../data/mockProperties';
import { addDays, toLocalDateTime } from '../lib/dateTime';
import type { ApplicationStore } from '../features/applications/mockApplicationRepository';
import type { RentalApplication } from '../features/applications/types';
import type { MessagingStores } from '../features/messaging/mockConversationRepository';
import type { Conversation, Message } from '../features/messaging/types';
import type { MockUser } from '../features/session/types';
import { fullNameOf } from '../features/session/sessionLogic';
import type { ViewingStore } from '../features/viewings/mockViewingRepository';
import { applyOwnerCommand, createViewing } from '../features/viewings/viewingRules';
import type { NotificationStore } from '../features/notifications/mockNotificationRepository';
import { notificationId, viewingNotification } from '../features/notifications/notificationLogic';

// DEMO ONLY. Sample conversations, viewings, an application and a notification so the screens can be seen filled in.
// Everything here is fictional, and anything written "by a landlord" is marked simulated. Added only when
// the person presses the button on the Demo landlord screen; nothing is created automatically.

type Handles = { messaging: MessagingStores; viewings: ViewingStore; applications: ApplicationStore; notifications: NotificationStore };

const property = (id: string) => {
  const p = DEMO_PROPERTIES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown demo property ${id}`);
  return p;
};

export async function seedDemoCommunication(h: Handles, user: MockUser, now: Date = new Date()): Promise<{ added: boolean }> {
  const uid = user.id;
  const id = (name: string) => `demo-seed:${uid}:${name}`;
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60000).toISOString();

  const existing = await h.messaging.conversations.all();
  if (existing.some((c) => c.id.startsWith(`demo-seed:${uid}:`))) return { added: false };

  const conv = (name: string, propertyId: string, minutesAgo: number): Conversation => {
    const p = property(propertyId);
    return { id: id(name), propertyId, studentId: uid, ownerId: p.ownerId, origin: 'property_detail', listingPlanId: p.planId, createdAt: at(minutesAgo), lastMessageAt: null };
  };
  const msg = (n: string, c: Conversation, from: 'student' | 'owner', body: string, minutesAgo: number): Message => ({
    id: id(n), conversationId: c.id, senderId: from === 'student' ? uid : c.ownerId, kind: 'text', body, viewingRequestId: null, eventCode: null, eventId: null, eventStart: null, eventRelatedStart: null, eventStatus: null, createdAt: at(minutesAgo), editedAt: null, simulated: from === 'owner',
  });

  const mara = conv('conv-mara', 'demo-1', 200);
  const campus = conv('conv-campus', 'demo-10', 1500);
  const andrei = conv('conv-andrei', 'demo-3', 4000);
  const today = toLocalDateTime(now).slice(0, 10);
  const confirmedStart = `${addDays(today, 1)}T17:30`;
  const pendingStart = `${addDays(today, 2)}T11:00`;

  const nowLocal = toLocalDateTime(now);
  const requested = createViewing({ id: id('viewing-confirmed'), propertyId: 'demo-1', studentId: uid, ownerId: mara.ownerId, start: confirmedStart, note: null, origin: 'conversation', listingPlanId: mara.listingPlanId, nowIso: at(150) });
  const confirmation = applyOwnerCommand(requested, { type: 'confirm' }, { actorId: mara.ownerId, nowIso: at(120), nowLocal, simulated: true });
  if (!confirmation.ok) throw new Error(confirmation.message);
  const confirmed = confirmation.value;
  const pending = createViewing({ id: id('viewing-pending'), propertyId: 'demo-2', studentId: uid, ownerId: property('demo-2').ownerId, start: pendingStart, note: null, origin: 'property_detail', listingPlanId: property('demo-2').planId, nowIso: at(60) });
  const application: RentalApplication = {
    id: id('application'), propertyId: 'demo-4', studentId: uid, ownerId: property('demo-4').ownerId,
    applicantName: fullNameOf(user) ?? 'Demo student', applicantEmail: user.email, applicantPhone: user.phone ?? '+40700000000',
    preferredMoveIn: addDays(today, 30), leaseMonths: 12, occupants: 1, university: 'UAIC', studyStatus: 'master', message: 'Sample application (demo data).',
    consentAcceptedAt: at(300), status: 'submitted', createdAt: at(300), updatedAt: at(300), origin: 'property_detail', listingPlanId: property('demo-4').planId,
    history: [{ id: id('application') + ':s1', status: 'submitted', at: at(300), actorId: uid, actorRole: 'student', simulated: false }],
  };

  const messages: Message[] = [
    msg('m1', mara, 'owner', 'Bună! Thanks for your interest. The studio is still available from 1 September.', 190),
    msg('m2', mara, 'student', 'Great, thank you! I’d love to see it in person. Is Thursday afternoon possible?', 185),
    msg('m3', mara, 'owner', 'Thursday at 17:30 works perfectly. Shall I confirm a viewing for you?', 180),
    { id: id('m4'), conversationId: mara.id, senderId: mara.ownerId, kind: 'viewing_event', body: '', viewingRequestId: confirmed.id, eventCode: 'confirmed', eventId: confirmation.entry.id, eventStart: confirmedStart, eventRelatedStart: null, eventStatus: 'confirmed', createdAt: at(120), editedAt: null, simulated: true },
    msg('m5', campus, 'owner', 'Your viewing request is confirmed.', 1400),
    msg('m6', andrei, 'owner', 'The apartment is still available.', 3900),
  ];
  const lastOf = (c: Conversation) => messages.filter((m) => m.conversationId === c.id).map((m) => m.createdAt).sort().pop() ?? null;
  const conversations = [mara, campus, andrei].map((c) => ({ ...c, lastMessageAt: lastOf(c) }));

  await h.messaging.conversations.update((rows) => ({ rows: [...rows, ...conversations], result: undefined }));
  await h.messaging.messages.update((rows) => ({ rows: [...rows, ...messages], result: undefined }));
  // Read state: in the Mara conversation the student has read the first reply; the later reply and the confirmed-viewing
  // card are unread (2, as in the design). The other two conversations have been read.
  await h.messaging.reads.update((rows) => ({
    rows: [...rows, { conversationId: mara.id, userId: uid, lastReadAt: at(184), hiddenAt: null, deletedAt: null }, { conversationId: campus.id, userId: uid, lastReadAt: at(1300), hiddenAt: null, deletedAt: null }, { conversationId: andrei.id, userId: uid, lastReadAt: at(3800), hiddenAt: null, deletedAt: null }],
    result: undefined,
  }));
  await h.viewings.update((rows) => ({ rows: [...rows, confirmed, pending], result: undefined }));
  await h.applications.update((rows) => ({ rows: [...rows, application], result: undefined }));
  // One unread notification: the (simulated) landlord confirmed the viewing.
  const note = viewingNotification(confirmed, confirmation.entry, property('demo-1').title);
  if (note) await h.notifications.update((rows) => ({ rows: [...rows, { ...note, id: notificationId(uid, confirmation.entry.id), createdAt: at(120), readAt: null, deletedAt: null }], result: undefined }));
  return { added: true };
}

/** Removes this account's conversations, messages, viewing requests and applications (saved homes are kept). */
export async function clearDemoCommunication(h: Handles, userId: string): Promise<void> {
  const mine = new Set((await h.messaging.conversations.all()).filter((c) => c.studentId === userId).map((c) => c.id));
  await h.messaging.conversations.update((rows) => ({ rows: rows.filter((c) => !mine.has(c.id)), result: undefined }));
  await h.messaging.messages.update((rows) => ({ rows: rows.filter((m) => !mine.has(m.conversationId)), result: undefined }));
  await h.messaging.reads.update((rows) => ({ rows: rows.filter((r) => !mine.has(r.conversationId)), result: undefined }));
  await h.viewings.update((rows) => ({ rows: rows.filter((v) => v.studentId !== userId), result: undefined }));
  await h.applications.update((rows) => ({ rows: rows.filter((a) => a.studentId !== userId), result: undefined }));
  await h.notifications.update((rows) => ({ rows: rows.filter((n) => n.userId !== userId), result: undefined }));
}
