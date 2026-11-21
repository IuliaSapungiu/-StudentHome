/// <reference types="node" />
import assert from 'node:assert/strict';
import { makeProperty, makeUser, makeWorld, verified } from '../test-support';
import { createMessagingStores, createMockConversationRepository } from './mockConversationRepository';
import { afterCutoffs, supersededCardIds, visibleSummaries, visibleTo } from './messagingLogic';
import type { Message } from './types';

// Deleting a conversation clears ONE person's history. The other participant keeps everything, and the old messages and
// status cards never come back for the person who deleted, whatever happens next. Hide / Unhide stay reversible.

(async () => {
  const ana = makeUser('ana');
  const dan = makeUser('dan'); // a second student: must never be affected
  const owner = makeUser('owner-1');
  const w = makeWorld([ana, dan, owner], [verified(ana, 'email'), verified(dan, 'email')], [makeProperty('p1', 'owner-1'), makeProperty('p2', 'owner-1')]);
  const stores = createMessagingStores(w.storage);
  const repo = createMockConversationRepository({ stores, properties: w.propertyRepo, access: w.access, now: w.clock.now, newId: w.newId });
  const ev = (over: Record<string, unknown>) => ({ studentId: 'ana', ownerId: 'owner-1', propertyId: 'p1', listingPlanId: 'basic' as const, viewingRequestId: 'v1', eventId: 'v1:e1', eventStart: '2026-12-02T17:30', relatedStart: null, status: 'pending' as const, actorId: 'ana', code: 'requested' as const, simulated: false, createIfMissing: false, ...over });
  const thread = async (conversationId: string, user: string) => {
    const t = await repo.getThread(conversationId, user);
    assert.ok(t.ok, `thread for ${user}`);
    return (t as Extract<typeof t, { ok: true }>).value;
  };
  const bodies = async (conversationId: string, user: string) => (await thread(conversationId, user)).messages.map((m) => (m.kind === 'text' ? m.body : `[${m.eventCode}]`));
  const inbox = async (user: string) => (await repo.listForParticipant(user)).filter((s) => !s.hidden);

  // ---- two conversations for Ana (p1, p2), one for Dan (p1). All have history, including viewing cards.
  w.clock.advanceMinutes(1);
  const c1 = (await repo.startConversation({ studentId: 'ana', propertyId: 'p1', body: 'Old question 1' }) as { ok: true; value: { conversation: { id: string } } }).value.conversation.id;
  w.clock.advanceMinutes(1);
  await repo.sendMessage({ conversationId: c1, senderId: 'owner-1', body: 'Old answer' });
  w.clock.advanceMinutes(1);
  await repo.recordViewingEvent(ev({}));
  w.clock.advanceMinutes(1);
  await repo.recordViewingEvent(ev({ eventId: 'v1:e2', code: 'confirmed', status: 'confirmed', actorId: 'owner-1', simulated: true }));
  const c2 = (await repo.startConversation({ studentId: 'ana', propertyId: 'p2', body: 'Other property' }) as { ok: true; value: { conversation: { id: string } } }).value.conversation.id;
  const cDan = (await repo.startConversation({ studentId: 'dan', propertyId: 'p1', body: 'Dan here' }) as { ok: true; value: { conversation: { id: string } } }).value.conversation.id;
  assert.notEqual(c1, cDan);
  const ownerOldHistory = await bodies(c1, 'owner-1');
  assert.deepEqual(ownerOldHistory, ['Old question 1', 'Old answer', '[requested]', '[confirmed]']);

  // ================= 1. the student deletes the conversation =================
  w.clock.advanceMinutes(1);
  assert.ok((await repo.deleteConversation(c1, 'ana')).ok);
  assert.equal((await inbox('ana')).some((s) => s.conversation.id === c1), false, 'gone from the student inbox');
  assert.equal((await repo.listForParticipant('ana')).some((s) => s.conversation.id === c1), false, 'and from the hidden list');

  // ---- 2. the landlord's old history is intact, and no message was physically removed
  assert.deepEqual(await bodies(c1, 'owner-1'), ownerOldHistory, "the landlord still sees the complete old history");
  assert.equal((await inbox('owner-1')).some((s) => s.conversation.id === c1), true, 'and still has it in their inbox');
  assert.equal((await stores.messages.all()).filter((m) => m.conversationId === c1).length, 4, 'all 4 shared messages are still stored');

  // ---- 3. the student no longer sees old messages or status cards (even when opening the conversation id directly)
  assert.deepEqual(await bodies(c1, 'ana'), [], 'no old messages, no old status cards');
  assert.equal((await thread(c1, 'ana')).messages.some((m) => m.kind === 'viewing_event'), false);

  // ---- 4. the landlord sends a NEW message (and no time passes: same instant must still count as new)
  assert.ok((await repo.sendMessage({ conversationId: c1, senderId: 'owner-1', body: 'New message after delete' })).ok);

  // ---- 5. the student sees a fresh timeline: only the new message; the conversation is back in the normal list, unread
  assert.deepEqual(await bodies(c1, 'ana'), ['New message after delete']);
  const back = (await inbox('ana')).find((s) => s.conversation.id === c1);
  assert.ok(back, 'back in the normal Messages list');
  assert.equal(back!.unreadCount, 1, 'unread counts only the new message, not the old ones');
  assert.equal(back!.lastMessage?.body, 'New message after delete');
  assert.equal(back!.deleted, false);
  assert.equal(back!.hidden, false);
  assert.equal((await repo.listForParticipant('ana')).reduce((n, s) => n + s.unreadCount, 0), 1 + (await repo.listForParticipant('ana')).filter((s) => s.conversation.id !== c1).reduce((n, s) => n + s.unreadCount, 0), 'the Messages tab total is consistent');
  await repo.markRead(c1, 'ana');
  assert.equal((await inbox('ana')).find((s) => s.conversation.id === c1)!.unreadCount, 0, 'reading it clears the unread count');

  // ---- 6. the landlord sees the complete old AND new history
  assert.deepEqual(await bodies(c1, 'owner-1'), [...ownerOldHistory, 'New message after delete']);

  // a new viewing card after the cutoff shows up for the student, and only that one
  w.clock.advanceMinutes(1);
  await repo.recordViewingEvent(ev({ viewingRequestId: 'v2', eventId: 'v2:e1', eventStart: '2026-12-09T10:00', actorId: 'owner-1', code: 'confirmed', status: 'confirmed', simulated: true }));
  assert.deepEqual(await bodies(c1, 'ana'), ['New message after delete', '[confirmed]']);
  assert.equal((await thread(c1, 'ana')).messages[1].viewingRequestId, 'v2', 'the old viewing card (v1) did not come back');
  // the student writing again also starts from the fresh timeline
  w.clock.advanceMinutes(1);
  await repo.sendMessage({ conversationId: c1, senderId: 'ana', body: 'Hello again' });
  assert.deepEqual(await bodies(c1, 'ana'), ['New message after delete', '[confirmed]', 'Hello again']);
  // old messages cannot be edited or deleted through the repository either (not visible = not found)
  const oldId = (await thread(c1, 'owner-1')).messages[0].id;
  const tryOld = await repo.editMessage({ messageId: oldId, userId: 'ana', body: 'sneaky' });
  assert.ok(!tryOld.ok && tryOld.error.code === 'not_found');
  const tryOldDelete = await repo.deleteMessage({ messageId: oldId, userId: 'ana' });
  assert.ok(!tryOldDelete.ok && tryOldDelete.error.code === 'not_found');

  // deleting a second time moves the cutoff forward again; nothing old returns
  w.clock.advanceMinutes(1);
  assert.ok((await repo.deleteConversation(c1, 'ana')).ok);
  assert.deepEqual(await bodies(c1, 'ana'), []);
  w.clock.advanceMinutes(1);
  await repo.sendMessage({ conversationId: c1, senderId: 'owner-1', body: 'Third wave' });
  assert.deepEqual(await bodies(c1, 'ana'), ['Third wave']);
  assert.equal((await bodies(c1, 'owner-1')).length, ownerOldHistory.length + 4);

  // ---- 7. other conversations and other accounts are unaffected
  assert.deepEqual(await bodies(c2, 'ana'), ['Other property'], "Ana's other conversation is untouched");
  assert.deepEqual(await bodies(cDan, 'dan'), ['Dan here'], "Dan's conversation about the same property is untouched");
  assert.equal((await inbox('dan')).length, 1);
  assert.deepEqual((await thread(c1, 'owner-1')).messages.length, ownerOldHistory.length + 4);
  assert.ok(!(await repo.getThread(c1, 'dan')).ok, 'participant isolation: Dan cannot open the conversation');
  assert.equal((await stores.conversations.all()).filter((c) => c.studentId === 'ana' && c.propertyId === 'p1').length, 1, 'one conversation per student per property: no duplicate row exists');
  assert.equal((await repo.startConversation({ studentId: 'ana', propertyId: 'p1', body: 'again via the property page' }) as { ok: true; value: { conversation: { id: string } } }).value.conversation.id, c1, 'still ONE conversation per student per property: no duplicate id is created');
  assert.deepEqual(await bodies(c1, 'ana'), ['Third wave', 'again via the property page']);

  // ---- persistence: the cutoff survives a reload (a new repository over the same storage)
  const reopened = createMockConversationRepository({ stores: createMessagingStores(w.storage), properties: w.propertyRepo, access: w.access, now: w.clock.now, newId: w.newId });
  const t = await reopened.getThread(c1, 'ana');
  assert.ok(t.ok && t.value.messages.map((m) => m.body).join('|') === 'Third wave|again via the property page', 'still only the new content after reload');

  // ================= Hide / Unhide: reversible, state-aware, in sync =================
  const state = async (u: string) => (await repo.listForParticipant(u)).find((s) => s.conversation.id === c2);
  assert.equal((await thread(c2, 'ana')).hidden, false, 'a normal conversation reports hidden = false (menu offers "Hide")');
  assert.ok((await repo.hideConversation(c2, 'ana')).ok);
  assert.equal((await thread(c2, 'ana')).hidden, true, 'a hidden one reports hidden = true (menu offers "Unhide")');
  assert.equal((await state('ana'))!.hidden, true, 'the list agrees with the thread');
  assert.deepEqual(visibleSummaries(await repo.listForParticipant('ana'), true).map((s) => s.conversation.id), [c2], 'it is in the Hidden list');
  assert.equal(visibleSummaries(await repo.listForParticipant('ana'), false).some((s) => s.conversation.id === c2), false, 'and not in the normal list');
  assert.equal((await repo.getThread(c2, 'owner-1') as { ok: true; value: { hidden: boolean } }).value.hidden, false, "hiding is the student's own");
  const afterReload = createMockConversationRepository({ stores: createMessagingStores(w.storage), properties: w.propertyRepo, access: w.access, now: w.clock.now, newId: w.newId });
  assert.equal(((await afterReload.getThread(c2, 'ana')) as { ok: true; value: { hidden: boolean } }).value.hidden, true, 'hidden survives an app reload');
  assert.ok((await repo.unhideConversation(c2, 'ana')).ok);
  assert.equal((await thread(c2, 'ana')).hidden, false);
  assert.equal(visibleSummaries(await repo.listForParticipant('ana'), false).some((s) => s.conversation.id === c2), true, 'Unhide restores it to the normal list');
  assert.deepEqual(await bodies(c2, 'ana'), ['Other property'], 'hide / unhide never touch the history');
  // hiding does NOT set a history cutoff: hiding then unhiding shows the same messages
  assert.deepEqual(await bodies(c1, 'ana'), ['Third wave', 'again via the property page']);

  // ================= pure rules =================
  const msgs = [{ createdAt: '2026-11-01T10:00:00.000Z' }, { createdAt: '2026-11-01T11:00:00.000Z' }];
  assert.equal(visibleTo(msgs, null).length, 2, 'no cutoff = everything');
  assert.equal(visibleTo(msgs, '2026-11-01T10:00:00.000Z').length, 1, 'strictly after the cutoff');
  assert.equal(afterCutoffs('2026-11-01T10:00:00.000Z', [null, '2026-11-01T10:00:00.000Z']), '2026-11-01T10:00:00.001Z', 'a tie is broken in favour of the new message');
  assert.equal(afterCutoffs('2026-11-01T10:00:05.000Z', ['2026-11-01T10:00:00.000Z']), '2026-11-01T10:00:05.000Z', 'a later time is left as it is');

  // ================= superseded viewing cards =================
  const card = (id: string, request: string | null, at: number, kind: Message['kind'] = 'viewing_event'): Message => ({
    id, conversationId: 'c', senderId: 'owner-1', kind, body: kind === 'text' ? 'hi' : '', createdAt: new Date(Date.UTC(2026, 10, 1, 10, at)).toISOString(), editedAt: null,
    viewingRequestId: request, eventCode: kind === 'text' ? null : 'requested', eventId: id, eventStart: null, eventRelatedStart: null, eventStatus: null, simulated: false,
  });
  // one lifecycle: requested -> proposed -> proposed again -> confirmed. Only the newest is current.
  const lifecycle = [card('a1', 'A', 1), card('a2', 'A', 2), card('a3', 'A', 3), card('a4', 'A', 4)];
  assert.deepEqual([...supersededCardIds(lifecycle)].sort(), ['a1', 'a2', 'a3'], 'every earlier card of the lifecycle is superseded; the newest is not');
  // two independent viewing requests keep their own current card
  const two = [card('a1', 'A', 1), card('b1', 'B', 2), card('a2', 'A', 3), card('b2', 'B', 4), card('b3', 'B', 5)];
  assert.deepEqual([...supersededCardIds(two)].sort(), ['a1', 'b1', 'b2'], 'A keeps a2, B keeps b3');
  // a text message in between never supersedes anything, and is never superseded
  const mixed = [card('a1', 'A', 1), card('t1', null, 2, 'text'), card('a2', 'A', 3), card('t2', null, 4, 'text')];
  assert.deepEqual([...supersededCardIds(mixed)], ['a1'], 'text messages are never muted');
  // input order does not matter; a single card is current; empty is fine
  assert.deepEqual([...supersededCardIds([...lifecycle].reverse())].sort(), ['a1', 'a2', 'a3']);
  assert.equal(supersededCardIds([card('only', 'A', 1)]).size, 0);
  assert.equal(supersededCardIds([]).size, 0);
  // after a delete, only the visible cards are considered: the surviving one is current again
  assert.equal(supersededCardIds(visibleTo(lifecycle, lifecycle[2].createdAt)).size, 0, 'the single visible card of the lifecycle is current');
  // and through the repository: a real thread of one viewing lifecycle
  const th = await thread(c1, 'owner-1');
  const real = supersededCardIds(th.messages);
  const v1Cards = th.messages.filter((m) => m.viewingRequestId === 'v1');
  assert.equal(v1Cards.length, 2);
  assert.equal(real.has(v1Cards[0].id), true, 'requested is superseded by confirmed');
  assert.equal(real.has(v1Cards[1].id), false, 'confirmed is current');
  assert.equal(real.has(th.messages.find((m) => m.viewingRequestId === 'v2')!.id), false, 'the independent v2 request keeps its own current card');

  console.log('conversationHistory: all checks passed');
})();
