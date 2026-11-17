/// <reference types="node" />
import assert from 'node:assert/strict';
import { makeProperty, makeUser, makeWorld, verified } from '../test-support';
import { createMessagingStores, createMockConversationRepository } from './mockConversationRepository';
import { canModifyMessage, changeDeadline, MESSAGE_MAX_LENGTH, matchesSearch, previewOf, unreadCount, validateMessageBody, isReadByCounterpart, visibleSummaries } from './messagingLogic';

(async () => {
  const ana = makeUser('ana'); // verified email
  const bob = makeUser('bob'); // email NOT verified
  const owner = makeUser('owner-1');
  const w = makeWorld([ana, bob, owner], [verified(ana, 'email')], [makeProperty('p1', 'owner-1', { planId: 'premium' }), makeProperty('p2', 'owner-2'), makeProperty('draft', 'owner-1', { status: 'draft' })]);
  const stores = createMessagingStores(w.storage);
  const repo = createMockConversationRepository({ stores, properties: w.propertyRepo, access: w.access, now: w.clock.now, newId: w.newId });

  // ---- validation helpers
  assert.deepEqual(validateMessageBody('  hi  '), { ok: true, body: 'hi' });
  assert.equal(validateMessageBody('   ').ok, false);
  assert.equal(validateMessageBody('x'.repeat(MESSAGE_MAX_LENGTH + 1)).ok, false);
  assert.equal(validateMessageBody('x'.repeat(MESSAGE_MAX_LENGTH)).ok, true);
  assert.ok(matchesSearch(['Mara Popescu', 'Bright studio', 'Tineretului'], 'tineretulu mara'), 'accent/case-insensitive, all words');
  assert.ok(matchesSearch(['Mărăști'], 'marasti'));
  assert.ok(!matchesSearch(['Mara'], 'andrei'));
  assert.ok(matchesSearch([], '  '), 'empty search matches everything');

  // ---- the email gate is enforced by the repository itself
  const blocked = await repo.startConversation({ studentId: 'bob', propertyId: 'p1', body: 'Hello' });
  assert.ok(!blocked.ok && blocked.error.code === 'not_allowed' && blocked.error.access?.requires === 'verified_email');
  assert.deepEqual(await repo.listForParticipant('bob'), [], 'nothing was created for the blocked attempt');
  const ghost = await repo.startConversation({ studentId: 'nobody', propertyId: 'p1', body: 'Hello' });
  assert.ok(!ghost.ok && ghost.error.access?.requires === 'account');

  // ---- starting a conversation creates and persists both the conversation and the message
  w.clock.advanceMinutes(1);
  const started = await repo.startConversation({ studentId: 'ana', propertyId: 'p1', body: '  Is it still available?  ' });
  assert.ok(started.ok);
  if (!started.ok) throw new Error('unreachable');
  assert.equal(started.value.message.body, 'Is it still available?');
  assert.equal(started.value.conversation.ownerId, 'owner-1', 'owner is copied from the property');
  assert.equal(started.value.conversation.listingPlanId, 'premium', 'attribution: plan at the time');
  const convId = started.value.conversation.id;
  assert.equal((await repo.findForProperty('ana', 'p1'))?.id, convId);

  // one conversation per student per property: starting again appends to it
  w.clock.advanceMinutes(1);
  const again = await repo.startConversation({ studentId: 'ana', propertyId: 'p1', body: 'Also: pets?' });
  assert.ok(again.ok && again.value.conversation.id === convId);
  assert.equal((await repo.listForParticipant('ana')).length, 1);
  // double tap = two racing starts still produce ONE conversation
  const race = await Promise.all([repo.startConversation({ studentId: 'ana', propertyId: 'p2', body: 'a' }), repo.startConversation({ studentId: 'ana', propertyId: 'p2', body: 'b' })]);
  assert.ok(race.every((r) => r.ok));
  assert.equal((await repo.listForParticipant('ana')).length, 2);

  // ---- refusals
  const own = await repo.startConversation({ studentId: 'owner-1', propertyId: 'p1', body: 'hi' });
  assert.ok(!own.ok); // owner-1 has no verified email either; make sure the rule is also checked for a verified owner
  const ownerVerified = makeWorld([ana, owner], [verified(ana, 'email'), verified(owner, 'email')], [makeProperty('p1', 'owner-1')]);
  const repo2 = createMockConversationRepository({ stores: createMessagingStores(ownerVerified.storage), properties: ownerVerified.propertyRepo, access: ownerVerified.access });
  const self = await repo2.startConversation({ studentId: 'owner-1', propertyId: 'p1', body: 'hi' });
  assert.ok(!self.ok && self.error.code === 'forbidden');
  const draft = await repo.startConversation({ studentId: 'ana', propertyId: 'draft', body: 'hi' });
  assert.ok(!draft.ok && draft.error.code === 'unavailable', 'unpublished listings cannot be messaged');
  const missing = await repo.startConversation({ studentId: 'ana', propertyId: 'nope', body: 'hi' });
  assert.ok(!missing.ok && missing.error.code === 'unavailable');
  const empty = await repo.startConversation({ studentId: 'ana', propertyId: 'p1', body: '   ' });
  assert.ok(!empty.ok && empty.error.code === 'invalid');

  // ---- unread counts derive from each participant's last-read time
  const list = async (u: string) => repo.listForParticipant(u);
  assert.equal((await list('ana'))[0].unreadCount, 0, 'my own messages are never unread');
  assert.equal((await list('owner-1'))[0].unreadCount, 2, 'the owner has two unread messages from the student');
  const before = await repo.getThread(convId, 'ana');
  assert.ok(before.ok && before.value.counterpartLastReadAt === null, 'the owner has not read anything yet');
  w.clock.advanceMinutes(5);
  const reply = await repo.sendMessage({ conversationId: convId, senderId: 'owner-1', body: 'Yes, from 1 September.' });
  assert.ok(reply.ok && reply.value.simulated === true, 'owner actions are marked simulated while landlords are not real accounts');
  let anaSummary = (await list('ana')).find((s) => s.conversation.id === convId)!;
  assert.equal(anaSummary.unreadCount, 1);
  assert.equal(anaSummary.lastMessage?.body, 'Yes, from 1 September.');
  assert.equal((await list('ana'))[0].conversation.id, convId, 'most recently active conversation first');

  // read state: the owner's read time drives "Read" on the student's messages
  let thread = await repo.getThread(convId, 'ana');
  assert.ok(thread.ok);
  if (!thread.ok) throw new Error('unreachable');
  const studentMsgs = thread.value.messages.filter((m) => m.senderId === 'ana');
  assert.equal(isReadByCounterpart(studentMsgs[1], thread.value.counterpartLastReadAt), true, 'replying means the owner has read the earlier messages');
  assert.equal(isReadByCounterpart(thread.value.messages[thread.value.messages.length - 1], null), false, 'nothing is read when the other side has no read time');
  w.clock.advanceMinutes(1);
  await repo.markRead(convId, 'owner-1');
  assert.equal((await list('owner-1'))[0].unreadCount, 0);

  // marking read twice, or on a conversation you are not in, changes nothing
  await repo.markRead(convId, 'ana');
  await repo.markRead(convId, 'ana');
  assert.equal((await list('ana')).find((s) => s.conversation.id === convId)!.unreadCount, 0);
  await repo.markRead(convId, 'bob');
  assert.deepEqual(await list('bob'), []);

  // a newer message after reading becomes unread again
  w.clock.advanceMinutes(1);
  await repo.sendMessage({ conversationId: convId, senderId: 'owner-1', body: 'Thursday 17:30?' });
  assert.equal((await list('ana')).find((s) => s.conversation.id === convId)!.unreadCount, 1);

  // ---- access: only participants see a thread; sending also re-checks the gate
  const hidden = await repo.getThread(convId, 'bob');
  assert.ok(!hidden.ok && hidden.error.code === 'not_found');
  const intruder = await repo.sendMessage({ conversationId: convId, senderId: 'bob', body: 'hi' });
  assert.ok(!intruder.ok && intruder.error.code === 'not_found');
  w.records.length = 0; // the student's email is no longer verified
  const lostGate = await repo.sendMessage({ conversationId: convId, senderId: 'ana', body: 'hi again' });
  assert.ok(!lostGate.ok && lostGate.error.code === 'not_allowed', 'sending re-checks the verification gate');
  w.records.push(verified(ana, 'email'));

  // ---- status cards: a student-side event never creates a conversation; a landlord confirmation / proposal does
  const sink = repo;
  const ev = (over: Record<string, unknown>) => ({ studentId: 'ana', ownerId: 'owner-9', propertyId: 'p2', listingPlanId: 'basic' as const, viewingRequestId: 'v1', eventId: 'v1:e1', eventStart: '2026-11-02T17:30', relatedStart: null, status: 'pending' as const, actorId: 'ana', code: 'requested' as const, simulated: false, createIfMissing: false, ...over });
  assert.deepEqual(await sink.recordViewingEvent(ev({ propertyId: 'nope' })), { posted: false, conversationId: null, createdConversation: false });
  assert.equal((await list('ana')).length, 2, 'no conversation was created');
  w.clock.advanceMinutes(1);
  const posted = await sink.recordViewingEvent(ev({ propertyId: 'p1', ownerId: 'owner-1' }));
  assert.equal(posted.posted, true);
  const top = (await list('ana'))[0];
  assert.equal(top.lastMessage?.kind, 'viewing_event');
  assert.equal(previewOf(top.lastMessage), 'Viewing requested');
  assert.equal(unreadCount(thread.value.messages, 'ana', null) >= 1, true);
  // dedupe: the same event id is never posted twice
  assert.equal((await sink.recordViewingEvent(ev({ propertyId: 'p1', ownerId: 'owner-1' }))).posted, false);
  // landlord-initiated: creates the conversation once, then reuses it
  const created = await sink.recordViewingEvent(ev({ studentId: 'bob', propertyId: 'p2', ownerId: 'owner-2', eventId: 'v9:e2', code: 'confirmed', actorId: 'owner-2', simulated: true, createIfMissing: true }));
  assert.deepEqual([created.posted, created.createdConversation], [true, true]);
  const reused = await sink.recordViewingEvent(ev({ studentId: 'bob', propertyId: 'p2', ownerId: 'owner-2', eventId: 'v9:e3', code: 'alternative_proposed', actorId: 'owner-2', simulated: true, createIfMissing: true }));
  assert.deepEqual([reused.posted, reused.createdConversation, reused.conversationId], [true, false, created.conversationId]);
  assert.equal((await list('bob')).length, 1, 'never a duplicate conversation for the same student and home');
  assert.equal((await list('bob'))[0].conversation.origin, 'viewing_update');

  // ---- editing and deleting: only the author, only normal messages, only for 20 minutes from the ORIGINAL send time
  w.clock.advanceMinutes(1);
  const mine = await repo.sendMessage({ conversationId: convId, senderId: 'ana', body: 'Typo here' });
  assert.ok(mine.ok);
  const mid = mine.ok ? mine.value.id : '';
  const sentAt = Date.parse(mine.ok ? mine.value.createdAt : '');
  const theirs = thread.value.messages.find((m) => m.senderId === 'owner-1' && m.kind === 'text')!;
  const card = await repo.getThread(convId, 'ana');
  const cardId = card.ok ? card.value.messages.find((m) => m.kind === 'viewing_event')!.id : '';
  assert.ok(!(await repo.editMessage({ messageId: theirs.id, userId: 'ana', body: 'hacked' })).ok, 'cannot edit someone else\'s message');
  assert.ok(!(await repo.deleteMessage({ messageId: theirs.id, userId: 'ana' })).ok, 'cannot delete someone else\'s message');
  const noCardEdit = await repo.editMessage({ messageId: cardId, userId: 'owner-1', body: 'x' });
  assert.ok(!noCardEdit.ok && noCardEdit.error.code === 'forbidden', 'status cards cannot be edited');
  const noCardDelete = await repo.deleteMessage({ messageId: cardId, userId: 'owner-1' });
  assert.ok(!noCardDelete.ok && noCardDelete.error.code === 'forbidden', 'status cards cannot be deleted');
  assert.ok(!(await repo.editMessage({ messageId: mid, userId: 'bob', body: 'x' })).ok, 'a non-participant sees nothing');
  assert.ok(!(await repo.editMessage({ messageId: mid, userId: 'ana', body: '   ' })).ok, 'an empty edit is refused');
  assert.equal(canModifyMessage(mine.ok ? mine.value : theirs, 'ana', w.clock.now()), true);
  assert.equal(canModifyMessage(mine.ok ? mine.value : theirs, 'owner-1', w.clock.now()), false, 'not the author');
  const realCard = card.ok ? card.value.messages.find((m) => m.kind === 'viewing_event') : undefined;
  assert.ok(realCard, 'the thread has a status card');
  assert.equal(canModifyMessage(realCard!, realCard!.senderId, w.clock.now()), false, 'a status card is never modifiable, even by the person it was recorded for');
  // editing 19 minutes after sending works, and does NOT extend the deadline
  w.clock.advanceMinutes(19);
  const edited = await repo.editMessage({ messageId: mid, userId: 'ana', body: '  Fixed text  ' });
  assert.ok(edited.ok && edited.value.body === 'Fixed text' && edited.value.editedAt !== null, 'keeps an edited time');
  assert.equal(edited.ok && edited.value.createdAt, mine.ok ? mine.value.createdAt : '', 'editing never moves the original send time');
  assert.equal(edited.ok && changeDeadline(edited.value).getTime(), sentAt + 20 * 60000, 'the deadline is still 20 minutes after the ORIGINAL send');
  const same = await repo.editMessage({ messageId: mid, userId: 'ana', body: 'Fixed text' });
  assert.ok(same.ok && same.value.editedAt === (edited.ok ? edited.value.editedAt : null), 'saving the same text is not an edit');
  w.records.length = 0;
  const gatedEdit = await repo.editMessage({ messageId: mid, userId: 'ana', body: 'Again' });
  assert.ok(!gatedEdit.ok && gatedEdit.error.code === 'not_allowed', 'editing needs the same verified email as sending');
  w.records.push(verified(ana, 'email'));
  // 20 minutes after the ORIGINAL send is still allowed; one second later is not, even though it was edited 1 minute ago
  w.clock.set(new Date(sentAt + 20 * 60000));
  assert.equal(canModifyMessage(edited.ok ? edited.value : theirs, 'ana', w.clock.now()), true, 'exactly 20:00 is still inside the window');
  w.clock.set(new Date(sentAt + 20 * 60000 + 1000));
  assert.equal(canModifyMessage(edited.ok ? edited.value : theirs, 'ana', w.clock.now()), false, 'one second later it is over');
  const lateEdit = await repo.editMessage({ messageId: mid, userId: 'ana', body: 'too late' });
  assert.ok(!lateEdit.ok && lateEdit.error.code === 'expired', 'the repository enforces the deadline, not just the UI');
  const lateDelete = await repo.deleteMessage({ messageId: mid, userId: 'ana' });
  assert.ok(!lateDelete.ok && lateDelete.error.code === 'expired', 'delete is refused after 20 minutes');
  assert.ok((await repo.getThread(convId, 'ana')).ok && ((await repo.getThread(convId, 'ana')) as { ok: true; value: { messages: { id: string }[] } }).value.messages.some((m) => m.id === mid), 'still there');

  // ---- hard delete: the message disappears completely, nothing else changes
  w.clock.set(new Date(sentAt + 25 * 60000));
  const fresh = await repo.sendMessage({ conversationId: convId, senderId: 'ana', body: 'Delete me' });
  const other = await repo.sendMessage({ conversationId: convId, senderId: 'ana', body: 'Keep me' });
  assert.ok(fresh.ok && other.ok);
  const beforeDelete = await repo.getThread(convId, 'ana');
  const countBefore = beforeDelete.ok ? beforeDelete.value.messages.length : -1;
  w.clock.advanceMinutes(10);
  const removed = await repo.deleteMessage({ messageId: fresh.ok ? fresh.value.id : '', userId: 'ana' });
  assert.ok(removed.ok, 'within 20 minutes of sending');
  const after = await repo.getThread(convId, 'owner-1');
  assert.ok(after.ok);
  const ids = after.ok ? after.value.messages.map((m) => m.id) : [];
  assert.equal(ids.length, countBefore - 1, 'exactly one record is gone');
  assert.ok(!ids.includes(fresh.ok ? fresh.value.id : ''), 'no placeholder: the message is simply not there (also for the other participant)');
  assert.ok(ids.includes(other.ok ? other.value.id : '') && ids.includes(cardId) && ids.includes(mid), 'other messages and status cards are untouched');
  assert.ok(after.ok && after.value.messages.every((m) => !('deletedAt' in m)), 'there is no soft-delete field any more');
  assert.ok(!(await repo.deleteMessage({ messageId: fresh.ok ? fresh.value.id : '', userId: 'ana' })).ok, 'a deleted message no longer exists');
  assert.ok(!(await repo.editMessage({ messageId: fresh.ok ? fresh.value.id : '', userId: 'ana', body: 'revive' })).ok);
  const lastOnly = (await list('ana')).find((s) => s.conversation.id === convId)!;
  assert.notEqual(previewOf(lastOnly.lastMessage), 'Message deleted');
  // the conversation's last-message time follows the remaining messages
  const last = after.ok ? after.value.messages.at(-1)! : null;
  assert.equal(lastOnly.conversation.lastMessageAt, last?.createdAt);
  // an unread message from the other person that they delete is no longer counted
  w.clock.advanceMinutes(1);
  const ownerMsg = await repo.sendMessage({ conversationId: convId, senderId: 'owner-1', body: 'will be removed' });
  const unreadBefore = (await list('ana')).find((s) => s.conversation.id === convId)!.unreadCount;
  await repo.deleteMessage({ messageId: ownerMsg.ok ? ownerMsg.value.id : '', userId: 'owner-1' });
  assert.equal((await list('ana')).find((s) => s.conversation.id === convId)!.unreadCount, unreadBefore - 1);
  // there is intentionally NO way to hide an individual message
  assert.equal('hideMessage' in repo, false, 'no hide-message operation exists');
  assert.equal('unhideMessage' in repo, false);
  const wrongTarget = await repo.hideConversation(mid, 'ana');
  assert.ok(!wrongTarget.ok && wrongTarget.error.code === 'not_found', 'a message id cannot be used to hide anything');
  assert.ok(Object.keys(thread.value.messages[0]).every((k) => !/hidden/i.test(k)), 'messages carry no hidden flag');
  // legacy soft-deleted rows saved by an earlier build vanish on read
  const legacy = [...(await stores.messages.all())];
  await w.storage.write('messaging.messages', [...legacy, { id: 'old', conversationId: convId, senderId: 'ana', kind: 'text', body: '', createdAt: '2026-10-31T10:00:00.000Z', deletedAt: '2026-10-31T10:01:00.000Z', simulated: false }]);
  assert.equal((await stores.messages.all()).some((m) => m.id === 'old'), false, 'an old soft-deleted message is dropped');
  await w.storage.write('messaging.messages', legacy);
  w.clock.set(new Date(sentAt + 40 * 60000));

  // ---- hide and delete are participant-specific; the shared conversation and messages are never changed
  const state = async (u: string, includeDeleted = false) => (await repo.listForParticipant(u, { includeDeleted })).find((x) => x.conversation.id === convId);
  assert.equal((await state('ana'))!.hidden, false);
  assert.ok((await repo.hideConversation(convId, 'ana')).ok);
  assert.deepEqual([(await state('ana'))!.hidden, (await state('ana'))!.deleted], [true, false], 'hidden: reversible, listed as hidden');
  assert.deepEqual([(await state('owner-1'))!.hidden, (await state('owner-1'))!.deleted], [false, false], 'the other participant is unaffected');
  assert.ok((await repo.getThread(convId, 'ana')).ok, 'hiding deletes nothing');
  assert.ok(!(await repo.hideConversation(convId, 'bob')).ok, 'only a participant can hide it');
  assert.ok((await repo.unhideConversation(convId, 'ana')).ok);
  assert.equal((await state('ana'))!.hidden, false);
  // delete: gone from the student's normal AND hidden lists, no unhide, nothing shared changes
  const messageCount = ((await repo.getThread(convId, 'owner-1')) as { ok: true; value: { messages: unknown[] } }).value.messages.length;
  assert.ok((await repo.deleteConversation(convId, 'ana')).ok);
  assert.equal(await state('ana'), undefined, 'not in the normal list');
  assert.equal((await state('ana', true))!.deleted, true, 'only reachable when asking for deleted ones explicitly');
  assert.equal(visibleSummaries(await repo.listForParticipant('ana', { includeDeleted: true }), false).length, 1, 'visibleSummaries(inbox) excludes it');
  assert.equal(visibleSummaries(await repo.listForParticipant('ana', { includeDeleted: true }), true).length, 0, 'and so does the hidden list');
  assert.ok(await state('owner-1'), 'the other participant still has it');
  assert.equal(((await repo.getThread(convId, 'owner-1')) as { ok: true; value: { messages: unknown[] } }).value.messages.length, messageCount, 'no message was deleted');
  assert.ok((await repo.unhideConversation(convId, 'ana')).ok);
  assert.equal(await state('ana'), undefined, 'unhide does not bring a deleted conversation back');
  assert.ok(!(await repo.deleteConversation(convId, 'bob')).ok, 'only a participant can delete it');
  // the other participant can keep using it, and a new incoming message brings it back for the student
  w.clock.advanceMinutes(1);
  assert.ok((await repo.sendMessage({ conversationId: convId, senderId: 'owner-1', body: 'Are you still interested?' })).ok);
  const back = await state('ana');
  assert.deepEqual([back!.hidden, back!.deleted], [false, false], 'a new incoming message makes it reappear in the normal inbox');
  assert.ok(back!.unreadCount >= 1);
  // the same for a hidden one, and for a viewing event from the landlord
  await repo.hideConversation(convId, 'ana');
  w.clock.advanceMinutes(1);
  await repo.sendMessage({ conversationId: convId, senderId: 'owner-1', body: 'Hello again' });
  assert.equal((await state('ana'))!.hidden, false, 'a hidden conversation also comes back');
  await repo.deleteConversation(convId, 'ana');
  w.clock.advanceMinutes(1);
  await sink.recordViewingEvent(ev({ eventId: 'v1:e5', propertyId: 'p1', ownerId: 'owner-1', code: 'confirmed', status: 'confirmed', actorId: 'owner-1', simulated: true }));
  assert.equal((await state('ana'))!.deleted, false, 'a landlord viewing event brings a deleted conversation back');
  // the student's OWN viewing action does not bring back the conversation they deleted
  await repo.deleteConversation(convId, 'ana');
  w.clock.advanceMinutes(1);
  await sink.recordViewingEvent(ev({ eventId: 'v1:e6', propertyId: 'p1', ownerId: 'owner-1', code: 'cancelled', status: 'cancelled', actorId: 'ana' }));
  assert.equal(await state('ana'), undefined, 'own cancellation does not revive it for the student');
  assert.equal((await state('owner-1'))!.hidden, false);
  // but writing a message yourself does
  w.clock.advanceMinutes(1);
  await repo.sendMessage({ conversationId: convId, senderId: 'ana', body: 'Writing again myself' });
  assert.equal((await state('ana'))!.deleted, false, 'writing in it again shows it again');
  // the landlord's own conversation is visible throughout
  await repo.hideConversation(convId, 'ana');
  await repo.deleteConversation(convId, 'ana');
  assert.ok(await state('owner-1'), 'the landlord still has it and can still reply');
  assert.ok((await repo.sendMessage({ conversationId: convId, senderId: 'owner-1', body: 'Reply while deleted' })).ok);
  assert.equal((await state('ana'))!.deleted, false);
  // read position survives
  await repo.markRead(convId, 'ana');
  await repo.hideConversation(convId, 'ana');
  assert.equal((await state('ana'))!.unreadCount, 0);
  await repo.unhideConversation(convId, 'ana');
  // a conversation whose messages were all deleted is not listed (but can still be found and reused)
  w.clock.advanceMinutes(1);
  w.properties.push(makeProperty('p3', 'owner-3'));
  const solo = await repo.startConversation({ studentId: 'ana', propertyId: 'p3', body: 'only message' });
  assert.ok(solo.ok);
  const soloId = solo.ok ? solo.value.conversation.id : '';
  const soloThread = (await repo.getThread(soloId, 'ana')) as { ok: true; value: { messages: { id: string }[] } };
  const soloMessages = soloThread.value.messages.length;
  for (const m of soloThread.value.messages) await repo.deleteMessage({ messageId: m.id, userId: 'ana' });
  assert.equal(soloMessages, 1);
  assert.equal((await repo.listForParticipant('ana')).some((x) => x.conversation.id === soloId), false, 'an emptied conversation is not listed for the student');
  assert.equal((await repo.listForParticipant('owner-3')).some((x) => x.conversation.id === soloId), false, 'nor for the landlord: there is nothing to show');
  assert.equal((await repo.findForProperty('ana', 'p3'))?.id, soloId, 'but it can still be found and reused');
  const reuse = await repo.startConversation({ studentId: 'ana', propertyId: 'p3', body: 'second try' });
  assert.ok(reuse.ok && reuse.value.conversation.id === soloId, 'writing again reuses it');


  // ---- persistence: a new repository over the same storage sees everything
  const reopened = createMockConversationRepository({ stores: createMessagingStores(w.storage), properties: w.propertyRepo, access: w.access });
  assert.equal((await reopened.listForParticipant('ana')).length, 3);
  assert.equal((await reopened.listForParticipant('ana')).some((c) => c.hidden), false);

  console.log('messaging: all checks passed');
})();
