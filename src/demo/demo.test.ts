/// <reference types="node" />
import assert from 'node:assert/strict';
import { DEMO_PROPERTIES } from '../data/mockProperties';
import { createMockPropertyRepository } from '../data/mockRepository';
import { createApplicationStore, createMockApplicationRepository } from '../features/applications/mockApplicationRepository';
import { createMockNotificationRepository, createNotificationStore } from '../features/notifications/mockNotificationRepository';
import { createMessagingStores, createMockConversationRepository } from '../features/messaging/mockConversationRepository';
import { createUser } from '../features/session/sessionLogic';
import { createAccessChecker } from '../features/verification/accessChecker';
import { createMockViewingRepository, createViewingStore } from '../features/viewings/mockViewingRepository';
import { bucketOf } from '../features/viewings/viewingRules';
import { createMemoryKeyValue, createMockStorage } from '../storage/keyValue';
import { toLocalDateTime } from '../lib/dateTime';
import { DEMO_PROPERTY_ADDRESSES } from '../data/mockAddresses';
import { clearDemoCommunication, seedDemoCommunication } from './demoCommunication';
import { createDemoLandlord } from './demoLandlord';

(async () => {
  const user = createUser('demo@example.com', 'student', 'demo-student', { fullName: 'Ana Popescu', phone: '+40712345678' });
  const storage = createMockStorage(createMemoryKeyValue());
  const now = new Date(2026, 9, 31, 10, 0);
  const properties = createMockPropertyRepository(DEMO_PROPERTIES);
  const access = createAccessChecker({ getUser: async () => user, listRecords: async () => [] });
  const stores = createMessagingStores(storage);
  const viewingStore = createViewingStore(storage);
  const applicationStore = createApplicationStore(storage);
  const notificationStore = createNotificationStore(storage);
  const notifications = createMockNotificationRepository({ store: notificationStore, now: () => now });
  const conversations = createMockConversationRepository({ stores, properties, access, now: () => now });
  const viewings = createMockViewingRepository({ store: viewingStore, properties, access, events: conversations, notifications, addresses: (id) => DEMO_PROPERTY_ADDRESSES[id] ?? null, now: () => now });
  const applications = createMockApplicationRepository({ store: applicationStore, properties, access, getUser: async () => user, notifications, now: () => now });
  const handles = { messaging: stores, viewings: viewingStore, applications: applicationStore, notifications: notificationStore };

  // every demo listing has a fictional address, kept apart from the public listing data
  for (const p of DEMO_PROPERTIES) assert.ok(DEMO_PROPERTY_ADDRESSES[p.id], `address for ${p.id}`);
  assert.ok(!JSON.stringify(await properties.search()).includes('Lănăriei'), 'exact addresses never appear in listings');

  // ---- seeding is explicit, idempotent and survives the real parsers
  assert.deepEqual(await conversations.listForParticipant('demo-student'), []);
  assert.equal((await seedDemoCommunication(handles, user, now)).added, true);
  assert.equal((await seedDemoCommunication(handles, user, now)).added, false, 'running it twice adds nothing');
  const list = await conversations.listForParticipant('demo-student');
  assert.equal(list.length, 3);
  assert.equal(list.reduce((n, s) => n + s.unreadCount, 0), 2, 'two unread landlord messages, as in the design');
  assert.ok(list.every((s) => s.lastMessage?.simulated || s.lastMessage?.kind === 'viewing_event'));
  const seededViewings = await viewings.listForStudent('demo-student');
  const nowLocal = toLocalDateTime(now);
  assert.deepEqual(seededViewings.map((v) => bucketOf(v, nowLocal)).sort(), ['pending', 'upcoming']);
  const confirmed = seededViewings.find((v) => v.status === 'confirmed')!;
  assert.equal(await viewings.getConfirmedAddress(confirmed.id, 'demo-student'), 'Strada Lănăriei 78, Bucharest');
  assert.equal((await applications.listForStudent('demo-student')).length, 1);
  assert.equal((await notifications.list('demo-student')).length, 1, 'one sample notification');
  assert.equal((await notifications.list('demo-student'))[0].readAt, null);
  assert.equal((await notifications.list('demo-student'))[0].kind, 'viewing_confirmed');

  // ---- the simulated landlord: explicit, labelled, and off when disabled
  const on = createDemoLandlord({ conversations, viewings, applications, enabled: () => true, now: () => now });
  const off = createDemoLandlord({ conversations, viewings, applications, enabled: () => false, now: () => now });
  const convo = list.find((s) => s.conversation.propertyId === 'demo-3')!.conversation;
  assert.equal((await off.reply(convo.id, convo.ownerId)).ok, false, 'disabled build: nothing happens');
  const reply = await on.reply(convo.id, convo.ownerId);
  assert.ok(reply.ok && reply.value.simulated === true, 'the reply is marked simulated');
  // ---- the student hiding or deleting a conversation never removes it from the landlord's side
  const landlordSees = async () => (await on.conversationsForStudent('demo-student')).find((r) => r.summary.conversation.id === convo.id);
  assert.equal((await landlordSees())?.studentInbox, 'visible');
  assert.ok((await conversations.hideConversation(convo.id, 'demo-student')).ok);
  assert.equal((await landlordSees())?.studentInbox, 'hidden', 'the landlord side still lists it after the student hides it');
  assert.equal((await conversations.listForParticipant('demo-student')).some((c) => c.conversation.id === convo.id && !c.hidden), false, 'and it is out of the student\'s inbox');
  const replyHidden = await on.reply(convo.id, convo.ownerId);
  assert.ok(replyHidden.ok, 'the demo landlord can still reply after the student hid it');
  assert.equal((await conversations.listForParticipant('demo-student')).find((c) => c.conversation.id === convo.id)?.hidden, false, 'the reply brings it back into the student\'s inbox');
  assert.ok((await conversations.deleteConversation(convo.id, 'demo-student')).ok);
  assert.equal((await landlordSees())?.studentInbox, 'deleted', 'the landlord side still lists it after the student deletes it');
  assert.equal((await conversations.listForParticipant('demo-student')).some((c) => c.conversation.id === convo.id), false);
  assert.ok((await conversations.listForParticipant(convo.ownerId)).some((c) => c.conversation.id === convo.id), 'it is in the landlord\'s own participant list throughout');
  const replyDeleted = await on.reply(convo.id, convo.ownerId);
  assert.ok(replyDeleted.ok, 'the demo landlord can reply to a conversation the student deleted');
  const revived = (await conversations.listForParticipant('demo-student')).find((c) => c.conversation.id === convo.id);
  assert.deepEqual([revived?.hidden, revived?.deleted], [false, false], 'a new incoming message makes it reappear in the normal inbox');
  assert.ok((revived?.unreadCount ?? 0) >= 1);
  assert.equal((await off.conversationsForStudent('demo-student')).length > 0, true, 'listing is read-only and goes through the same repository');
  assert.equal((await off.reply(convo.id, convo.ownerId)).ok, false, 'replies still need the demo flag');
  const pending = seededViewings.find((v) => v.status === 'pending')!;
  const alt = await on.proposeAlternative(pending);
  assert.ok(alt.ok && alt.value.status === 'alternative_proposed' && alt.value.history.at(-1)?.simulated === true);
  assert.equal(await viewings.getConfirmedAddress(pending.id, 'demo-student'), null, 'still no address until the student accepts');
  assert.equal((await notifications.list('demo-student')).filter((n) => n.kind === 'viewing_alternative_proposed' && n.actionRequired).length, 1, 'the demo landlord\'s proposal notifies the student');
  const accepted = await viewings.acceptAlternative(pending.id, 'demo-student');
  assert.ok(accepted.ok && accepted.value.status === 'confirmed');
  const app = (await applications.listForStudent('demo-student'))[0];
  assert.ok((await on.respondToApplication(app.id, app.ownerId, { type: 'accept' })).ok);
  assert.equal((await properties.getById(app.propertyId))?.status, 'published', 'accepting never changes the listing');

  // ---- clearing removes only this account's data
  await clearDemoCommunication(handles, 'demo-student');
  assert.deepEqual(await conversations.listForParticipant('demo-student'), []);
  assert.deepEqual(await viewings.listForStudent('demo-student'), []);
  assert.deepEqual(await applications.listForStudent('demo-student'), []);
  assert.deepEqual(await stores.messages.all(), []);
  assert.deepEqual(await notifications.list('demo-student'), []);

  console.log('demo: all checks passed');
})();
