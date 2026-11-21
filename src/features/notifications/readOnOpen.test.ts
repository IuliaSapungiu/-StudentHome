/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMockNotificationRepository, createNotificationStore } from './mockNotificationRepository';
import { createMemoryKeyValue, createMockStorage } from '../../storage/keyValue';
import { notificationTarget, unreadNotificationCount } from './notificationLogic';
import { viewingHref } from '../viewings/viewingRules';
import type { NewNotification } from './types';

// A notification becomes read when the exact viewing or application it is about is OPENED, by whichever route (tapping
// the notification, or going there directly). It is matched by the stable entity id, never by text. Opening a list or the
// notifications screen reads nothing. Nothing is ever deleted by reading.

const note = (over: Partial<NewNotification>): NewNotification => ({
  userId: 'ana', kind: 'viewing_confirmed', entityType: 'viewing', entityId: 'v1', propertyId: 'p1', propertyTitle: 'Home p1', eventId: 'v1:e2',
  title: 'Viewing confirmed', body: 'Same text on purpose.', actionRequired: false, simulated: true, ...over,
});

(async () => {
  const mk = () => {
    let t = Date.UTC(2026, 10, 1, 10, 0, 0);
    const repo = createMockNotificationRepository({ store: createNotificationStore(createMockStorage(createMemoryKeyValue())), now: () => new Date((t += 1000)) });
    return repo;
  };
  const unreadIds = async (repo: ReturnType<typeof mk>, user = 'ana') => (await repo.list(user)).filter((n) => n.readAt === null).map((n) => n.id).sort();

  const repo = mk();
  await repo.record(note({ eventId: 'v1:e2' })); // viewing v1: confirmed
  await repo.record(note({ eventId: 'v1:e3', kind: 'viewing_alternative_proposed', actionRequired: true })); // viewing v1: later event
  await repo.record(note({ entityId: 'v2', eventId: 'v2:e2' })); // another viewing, identical text
  await repo.record(note({ entityType: 'application', entityId: 'v1', eventId: 'a1:s2', kind: 'application_accepted', title: 'Viewing confirmed' })); // an APPLICATION whose id equals a viewing id, same title
  await repo.record(note({ userId: 'bob', eventId: 'v1:e2' })); // another account, same viewing id
  assert.equal(unreadNotificationCount(await repo.list('ana')), 4);

  // ---- opening the general screens reads nothing: those screens never call markEntityRead, and notifications are untouched
  assert.equal((await unreadIds(repo)).length, 4);

  // ---- direct navigation: opening viewing v1 reads ONLY v1's viewing notifications (by entity type + id, not by text)
  assert.equal(await repo.markEntityRead('ana', 'viewing', 'v1'), 2, 'both notifications about this viewing are seen on its screen');
  assert.deepEqual(await unreadIds(repo), ['ntf:ana:a1:s2', 'ntf:ana:v2:e2'], 'other viewings and the application stay unread');
  assert.equal((await repo.list('ana')).length, 4, 'nothing is deleted');
  assert.deepEqual(await unreadIds(repo, 'bob'), ['ntf:bob:v1:e2'], "another account's notification about the same viewing id is untouched");

  // ---- the type matters: an application with the same id is a different target
  assert.equal(await repo.markEntityRead('ana', 'application', 'v1'), 1);
  assert.deepEqual(await unreadIds(repo), ['ntf:ana:v2:e2']);

  // ---- repeating is harmless; unknown targets change nothing; a stranger cannot read someone else's
  const readAt = (await repo.list('ana')).find((n) => n.id === 'ntf:ana:v1:e2')!.readAt;
  assert.equal(await repo.markEntityRead('ana', 'viewing', 'v1'), 0, 'already read: nothing changes');
  assert.equal((await repo.list('ana')).find((n) => n.id === 'ntf:ana:v1:e2')!.readAt, readAt, 'the first read time is kept');
  assert.equal(await repo.markEntityRead('ana', 'viewing', 'nope'), 0);
  assert.equal(await repo.markEntityRead('carol', 'viewing', 'v2'), 0, 'an account with no notifications changes nothing');
  assert.deepEqual(await unreadIds(repo), ['ntf:ana:v2:e2'], 'v2 is still unread');

  // ---- the notification-tap route and the direct route end in the SAME state
  const tap = mk();
  const direct = mk();
  for (const r of [tap, direct]) {
    await r.record(note({ eventId: 'v1:e2' }));
    await r.record(note({ entityId: 'v2', eventId: 'v2:e2' }));
  }
  // tap: the screen marks the tapped notification read, then opens the viewing, which marks the viewing's notifications read
  const tapped = (await tap.list('ana')).find((n) => n.entityId === 'v1')!;
  assert.equal(await tap.markRead('ana', tapped.id), true);
  assert.deepEqual(notificationTarget(tapped), { screen: 'viewing', viewingId: 'v1' });
  assert.equal(JSON.stringify(viewingHref('v1')).includes('v1'), true, 'the tap goes to the exact viewing');
  await tap.markEntityRead('ana', 'viewing', 'v1');
  // direct: the student just opens that viewing
  await direct.markEntityRead('ana', 'viewing', 'v1');
  const shape = async (r: ReturnType<typeof mk>) => (await r.list('ana')).map((n) => [n.id, n.readAt === null]).sort();
  assert.deepEqual(await shape(tap), await shape(direct), 'both routes read exactly the same notifications');
  assert.deepEqual(await unreadIds(tap), ['ntf:ana:v2:e2']);

  // ---- a deleted notification is not revived by opening the item, and is not recreated when its event is processed again
  const del = mk();
  await del.record(note({ eventId: 'v1:e2' }));
  const only = (await del.list('ana'))[0];
  assert.equal(await del.delete('ana', only.id), true);
  assert.equal(await del.markEntityRead('ana', 'viewing', 'v1'), 0, 'a deleted notification is never touched');
  assert.equal((await del.list('ana')).length, 0, 'still deleted');
  assert.equal((await del.record(note({ eventId: 'v1:e2' }))).created, false, 'and still not recreated');
  assert.equal((await del.list('ana')).length, 0);
  // a NEW event for the same viewing after an earlier read is unread again until the item is opened again
  await del.record(note({ eventId: 'v1:e9', kind: 'viewing_declined' }));
  assert.equal(unreadNotificationCount(await del.list('ana')), 1);
  assert.equal(await del.markEntityRead('ana', 'viewing', 'v1'), 1);
  assert.equal(unreadNotificationCount(await del.list('ana')), 0);

  // ---- read / unread are states of ONE list (nothing is split into groups): read and unread rows are in the same chronological list
  const one = mk();
  await one.record(note({ eventId: 'v1:e2' }));
  await one.record(note({ entityId: 'v2', eventId: 'v2:e2' }));
  await one.markEntityRead('ana', 'viewing', 'v1');
  const list = await one.list('ana');
  assert.equal(list.length, 2, 'one list holds both');
  assert.ok(list[0].createdAt >= list[1].createdAt, 'newest first, whatever the read state');
  assert.deepEqual(list.map((n) => n.readAt === null), [true, false], 'unread v2 (newer) above read v1: states, not categories');

  console.log('readOnOpen: all checks passed');
})();
