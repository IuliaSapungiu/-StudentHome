/// <reference types="node" />
import assert from 'node:assert/strict';
import { makeProperty, makeStack, makeUser, makeWorld, verified } from '../test-support';
import { notificationId, notificationTarget, sortNotifications, unreadNotificationCount, viewingNotification } from './notificationLogic';
import { createMockNotificationRepository, createNotificationStore } from './mockNotificationRepository';
import { createMemoryKeyValue, createMockStorage } from '../../storage/keyValue';
import { viewingHref } from '../viewings/viewingRules';
import type { NewNotification } from './types';

const base: NewNotification = {
  userId: 'ana', kind: 'viewing_confirmed', entityType: 'viewing', entityId: 'v1', propertyId: 'p1', propertyTitle: 'Home p1', eventId: 'v1:e2',
  title: 'Viewing confirmed', body: 'Home p1: 2 Nov · 17:30.', actionRequired: false, simulated: true,
};

(async () => {
  // ---- the shared repository: stable ids, idempotent recording, read state, account isolation
  const storage = createMockStorage(createMemoryKeyValue());
  let t = Date.UTC(2026, 9, 31, 10, 0, 0);
  const repo = createMockNotificationRepository({ store: createNotificationStore(storage), now: () => new Date(t) });
  assert.equal(notificationId('ana', 'v1:e2'), 'ntf:ana:v1:e2');
  const first = await repo.record(base);
  assert.equal(first.created, true);
  assert.equal(first.notification.id, 'ntf:ana:v1:e2');
  assert.equal(first.notification.readAt, null, 'starts unread');
  t += 60000;
  const dup = await repo.record({ ...base, title: 'Changed text must not create a second one' });
  assert.equal(dup.created, false, 'the same event is recorded once');
  assert.equal(dup.notification.title, 'Viewing confirmed');
  const race = await Promise.all([repo.record({ ...base, eventId: 'v1:e3' }), repo.record({ ...base, eventId: 'v1:e3' })]);
  assert.deepEqual(race.map((r) => r.created).sort(), [false, true], 'two racing records still store one');
  assert.equal((await repo.list('ana')).length, 2);
  await repo.record({ ...base, userId: 'bob', eventId: 'v1:e2' });
  assert.equal((await repo.list('bob')).length, 1, 'the same event id for another account is a separate notification');
  assert.equal((await repo.list('bob'))[0].id, 'ntf:bob:v1:e2');
  assert.deepEqual(await repo.list('nobody'), []);

  // read / unread
  const list = await repo.list('ana');
  assert.equal(unreadNotificationCount(list), 2);
  assert.equal(await repo.markRead('bob', list[0].id), false, 'another account cannot mark it read');
  assert.equal(unreadNotificationCount(await repo.list('ana')), 2);
  assert.equal(await repo.markRead('ana', list[0].id), true);
  assert.equal(unreadNotificationCount(await repo.list('ana')), 1);
  const readAt = (await repo.list('ana')).find((n) => n.id === list[0].id)!.readAt;
  t += 60000;
  assert.equal(await repo.markRead('ana', list[0].id), true);
  assert.equal((await repo.list('ana')).find((n) => n.id === list[0].id)!.readAt, readAt, 'reading twice keeps the first read time');
  assert.equal(await repo.markRead('ana', 'missing'), false);
  assert.equal(await repo.markAllRead('bob'), 1);
  assert.equal(unreadNotificationCount(await repo.list('ana')), 1, 'mark-all only touches the caller\'s own');
  assert.equal(await repo.markAllRead('ana'), 1);
  assert.equal(unreadNotificationCount(await repo.list('ana')), 0);
  assert.equal(await repo.markAllRead('ana'), 0);
  // newest first; survives a restart; corrupt rows are dropped
  const sorted = sortNotifications(await repo.list('ana'));
  assert.ok(sorted[0].createdAt >= sorted[1].createdAt);
  const reopened = createMockNotificationRepository({ store: createNotificationStore(storage) });
  assert.equal((await reopened.list('ana')).length, 2);
  await storage.write('notifications', [{ id: 'x' }, 'junk', null, { ...first.notification }]);
  assert.equal((await reopened.list('ana')).length, 1);

  // ---- deleting: own notifications only, tombstoned so the same event never recreates it
  const del = createMockNotificationRepository({ store: createNotificationStore(createMockStorage(createMemoryKeyValue())), now: () => new Date(t) });
  await del.record({ ...base, eventId: 'e1' });
  await del.record({ ...base, eventId: 'e2' });
  await del.record({ ...base, userId: 'bob', eventId: 'e1' });
  const mineNow = await del.list('ana');
  assert.equal(await del.delete('bob', mineNow[0].id), false, 'another account cannot delete it');
  assert.equal((await del.list('ana')).length, 2);
  assert.equal(await del.delete('ana', mineNow[0].id), true);
  assert.equal((await del.list('ana')).length, 1, 'deleted notifications are not listed');
  assert.equal(unreadNotificationCount(await del.list('ana')), 1);
  assert.equal(await del.delete('ana', mineNow[0].id), false, 'deleting twice does nothing');
  assert.equal(await del.markRead('ana', mineNow[0].id), false, 'a deleted notification cannot be marked read');
  // processing the same event again must not bring it back
  const replay = await del.record({ ...base, eventId: mineNow[0].eventId });
  assert.equal(replay.created, false, 'a deleted notification is not recreated when its event is processed again');
  assert.equal((await del.list('ana')).length, 1);
  assert.ok((await del.list('bob')).length === 1, 'bob is untouched');
  // delete all: only the caller's, with a count; later NEW events still notify
  assert.equal(await del.deleteAll('ana'), 1);
  assert.deepEqual(await del.list('ana'), []);
  assert.equal((await del.list('bob')).length, 1, 'delete all never touches other accounts');
  assert.equal(await del.deleteAll('ana'), 0);
  assert.equal((await del.record({ ...base, eventId: 'e1' })).created, false, 'replaying an old event after Delete All creates nothing');
  assert.equal((await del.record({ ...base, eventId: 'e3-new-event' })).created, true, 'a genuinely new event still notifies');
  assert.equal((await del.list('ana')).length, 1);
  // persistence: deletions survive a restart and a reload
  const delStorage = createMockStorage(createMemoryKeyValue());
  const d1 = createMockNotificationRepository({ store: createNotificationStore(delStorage), now: () => new Date(t) });
  await d1.record({ ...base, eventId: 'p1' });
  await d1.deleteAll('ana');
  const d2 = createMockNotificationRepository({ store: createNotificationStore(delStorage), now: () => new Date(t) });
  assert.deepEqual(await d2.list('ana'), [], 'still deleted after a restart');
  assert.equal((await d2.record({ ...base, eventId: 'p1' })).created, false, 'and still not recreated');
  // viewings and applications use the same delete path: deleting a notification leaves the event itself alone
  // (covered below with the real repositories)

  // ---- navigation targets resolve from the entity (no stored paths)
  assert.deepEqual(notificationTarget({ entityType: 'viewing', entityId: 'v1' }), { screen: 'viewing', viewingId: 'v1' });
  assert.deepEqual(notificationTarget({ entityType: 'application', entityId: 'a1' }), { screen: 'application', applicationId: 'a1' });
  assert.deepEqual(viewingHref('v1'), { pathname: '/my-viewings', params: { viewingId: 'v1' } });

  // ---- viewings and applications feed the SAME repository, each event once, only for the student's account
  const ana = makeUser('ana');
  const bob = makeUser('bob');
  const w = makeWorld([ana, bob], [verified(ana, 'email'), verified(ana, 'phone'), verified(bob, 'email'), verified(bob, 'phone')], [makeProperty('p1', 'owner-1'), makeProperty('p2', 'owner-2')]);
  w.clock.set(new Date(2026, 9, 31, 10, 0));
  const stack = makeStack(w);
  const v = await stack.viewings.requestViewing({ studentId: 'ana', propertyId: 'p1', start: '2026-11-02T17:30' });
  const vb = await stack.viewings.requestViewing({ studentId: 'bob', propertyId: 'p1', start: '2026-11-02T18:30' });
  const app = await stack.applications.submit('ana', { propertyId: 'p2', preferredMoveIn: '2026-12-01', leaseMonths: 12, occupants: 1, university: 'ASE', studyStatus: 'master', message: null, consent: true });
  assert.ok(v.ok && vb.ok && app.ok);
  assert.deepEqual(await stack.notifications.list('ana'), [], 'requests and submissions by the student notify nobody');
  await stack.viewings.respond(v.ok ? v.value.id : '', 'owner-1', { type: 'confirm' });
  await stack.applications.respond(app.ok ? app.value.id : '', 'owner-2', { type: 'start_review' });
  await stack.applications.respond(app.ok ? app.value.id : '', 'owner-2', { type: 'accept' });
  const anaNotes = await stack.notifications.list('ana');
  assert.deepEqual(anaNotes.map((n) => n.kind).sort(), ['application_accepted', 'application_under_review', 'viewing_confirmed']);
  assert.deepEqual(await stack.notifications.list('bob'), [], 'bob has no notifications from ana\'s viewing');
  assert.ok(anaNotes.every((n) => n.userId === 'ana' && n.readAt === null));
  assert.equal(new Set(anaNotes.map((n) => n.id)).size, 3);
  // building a viewing notification directly yields nothing for the student's own events
  const mine = (await stack.viewings.getById(v.ok ? v.value.id : '', 'ana')) as { ok: true; value: Parameters<typeof viewingNotification>[0] };
  assert.equal(viewingNotification(mine.value, mine.value.history[0], 'Home p1'), null, 'a request is the student\'s own event');
  // a mixed list reads and navigates correctly
  const confirmedNote = anaNotes.find((n) => n.kind === 'viewing_confirmed')!;
  assert.deepEqual(notificationTarget(confirmedNote), { screen: 'viewing', viewingId: v.ok ? v.value.id : '' });
  const appNote = anaNotes.find((n) => n.kind === 'application_accepted')!;
  assert.deepEqual(notificationTarget(appNote), { screen: 'application', applicationId: app.ok ? app.value.id : '' });

  // deleting a notification does not touch the viewing it was about
  const del2 = await stack.notifications.list('ana');
  const vId = v.ok ? v.value.id : '';
  const viewingBefore = JSON.stringify(await stack.viewings.getById(vId, 'ana'));
  await stack.notifications.deleteAll('ana');
  assert.equal(JSON.stringify(await stack.viewings.getById(vId, 'ana')), viewingBefore, 'the viewing is unchanged');
  assert.equal((await stack.applications.listForStudent('ana')).length, 1, 'the application is unchanged');
  assert.equal(del2.length, 3);
  assert.deepEqual(await stack.notifications.list('ana'), []);
  await stack.viewings.respond(vId, 'owner-1', { type: 'complete' }); // refused (not past), must not recreate anything
  assert.deepEqual(await stack.notifications.list('ana'), []);

  console.log('notifications: all checks passed');
})();
