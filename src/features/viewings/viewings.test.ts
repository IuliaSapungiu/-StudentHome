/// <reference types="node" />
import assert from 'node:assert/strict';
import { toLocalDateTime } from '../../lib/dateTime';
import { monthGrid, shiftMonth } from '../../lib/calendar';
import { makeProperty, makeStack, makeUser, makeWorld, verified } from '../test-support';
import {
  bookableRange, bucketOf, canRevealAddress, currentProposal, defaultTimeFor, describeTimeline, effectiveStart, groupByDay, isActive, isDateSelectable, isHourSelectable, isMinuteValid,
  isTimeSelectable, nearestEnabled, originalRequestedStart, resolveViewingFocus, sortForTab, statusLabel, validateViewingTime, viewingHref,
} from './viewingRules';
import type { ViewingRequest } from './types';
import { addYears, dateRange, isWithinDateRange } from '../../lib/dateRange';
import { eventCardLines, eventCardSnapshot } from '../messaging/messagingLogic';

(async () => {
  const ana = makeUser('ana');
  const bob = makeUser('bob'); // email verified, phone NOT verified
  const cy = makeUser('cy'); // nothing verified
  const w = makeWorld([ana, bob, cy], [verified(ana, 'email'), verified(ana, 'phone'), verified(bob, 'email')], [makeProperty('p1', 'owner-1'), makeProperty('p2', 'owner-2'), makeProperty('own', 'ana')]);
  w.clock.set(new Date(2026, 9, 31, 10, 0)); // local wall clock: Sat 31 Oct 2026, 10:00
  const nowLocal = () => toLocalDateTime(w.clock.now());
  const { conversations, viewings: repo, notifications, viewingStore } = makeStack(w, { p1: 'Strada Fictivă 1, Bucharest', p2: 'Strada Fictivă 2, Bucharest' });
  const get = async (id: string) => (await repo.getById(id, 'ana')) as { ok: true; value: ViewingRequest };
  const inbox = async (userId: string) => notifications.list(userId);

  // ---- exact date and time: any minute, no fixed slots, no 30-day limit
  assert.equal(validateViewingTime('2026-11-01T17:07', nowLocal()).ok, true, 'minutes are exact, not on a half-hour grid');
  assert.equal(validateViewingTime('2026-11-01T00:00', nowLocal()).ok, true, 'no opening-hours restriction');
  assert.equal(validateViewingTime('2026-11-01T23:59', nowLocal()).ok, true);
  assert.equal(validateViewingTime('2027-03-15T09:41', nowLocal()).ok, true, 'a date well beyond 30 days is allowed');
  assert.equal(validateViewingTime('2026-10-31T10:01', nowLocal()).ok, true, 'any future minute is allowed (no minimum lead time)');
  assert.equal(validateViewingTime('2026-10-31T10:00', nowLocal()).ok, false, 'the current minute is not in the future');
  assert.equal(validateViewingTime('2026-10-31T09:59', nowLocal()).ok, false, 'past times are refused');
  assert.equal(validateViewingTime('2026-10-30T18:00', nowLocal()).ok, false, 'past days are refused');
  assert.equal(validateViewingTime('2029-01-01T10:00', nowLocal()).ok, false, 'only a two-year sanity bound remains');
  for (const bad of ['2026-13-45T10:00', '2026-11-01T24:00', '2026-11-01T10:60', '2026-11-01 10:00', null, undefined, 5]) assert.equal(validateViewingTime(bad, nowLocal()).ok, false, `invalid input ${String(bad)}`);
  assert.deepEqual(bookableRange(nowLocal()), { min: '2026-10-31', max: '2028-10-31' }, 'today to the same day two years later');
  assert.ok([0, 1, 29, 30, 59].every(isMinuteValid) && ![-1, 60, 1.5].some(isMinuteValid), 'minutes 0-59 are valid');
  // which times are selectable in the picker today (past times are disabled)
  assert.equal(isTimeSelectable('2026-10-31', 10, 0, nowLocal()), false);
  assert.equal(isTimeSelectable('2026-10-31', 10, 1, nowLocal()), true);
  assert.equal(isTimeSelectable('2026-10-31', 9, 59, nowLocal()), false);
  assert.equal(isTimeSelectable('2026-11-01', 0, 0, nowLocal()), true);
  assert.equal(isHourSelectable('2026-10-31', 9, nowLocal()), false);
  assert.equal(isHourSelectable('2026-10-31', 10, nowLocal()), true, 'the current hour still has later minutes');
  assert.equal(isDateSelectable('2026-10-30', nowLocal()), false);
  assert.equal(isDateSelectable('2026-10-31', nowLocal()), true);
  assert.deepEqual(defaultTimeFor('2026-10-31', nowLocal()), { hour: 11, minute: 0 }, 'today: about an hour from now');
  assert.deepEqual(defaultTimeFor('2026-11-02', nowLocal()), { hour: 12, minute: 0 });
  assert.equal(defaultTimeFor('2026-10-30', nowLocal()), null);
  assert.equal(defaultTimeFor('2026-10-31', '2026-10-31T23:59'), null, 'no time left today');
  assert.equal(nearestEnabled(60, 3, (i) => i >= 10), 10, 'dragging onto a past minute snaps to the nearest allowed one');
  assert.equal(nearestEnabled(5, 2, () => false), -1);
  const grid = monthGrid({ year: 2026, month: 11 });
  assert.equal(grid[0][6], '2026-11-01');
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });

  // ---- gates are enforced by the repository
  const noEmail = await repo.requestViewing({ studentId: 'cy', propertyId: 'p1', start: '2026-11-02T17:30' });
  assert.ok(!noEmail.ok && noEmail.error.code === 'not_allowed' && noEmail.error.access?.requires === 'verified_email');
  const noPhone = await repo.requestViewing({ studentId: 'bob', propertyId: 'p1', start: '2026-11-02T17:30' });
  assert.ok(!noPhone.ok && noPhone.error.access?.requires === 'verified_phone');
  assert.deepEqual(await repo.listForStudent('bob'), []);

  // ---- a request: exact minutes kept, one original proposal, no conversation, no notification
  const first = await repo.requestViewing({ studentId: 'ana', propertyId: 'p1', start: '2026-11-02T17:37', note: '  Bringing a friend  ' });
  assert.ok(first.ok);
  if (!first.ok) throw new Error('unreachable');
  const v1 = first.value;
  assert.equal(v1.status, 'pending');
  assert.equal(effectiveStart(v1), '2026-11-02T17:37');
  assert.equal(v1.studentNote, 'Bringing a friend');
  assert.deepEqual(v1.proposals.map((p) => [p.kind, p.proposedBy, p.outcome]), [['request', 'student', 'active']]);
  assert.equal(v1.history[0].id, `${v1.id}:e1`);
  assert.equal((await conversations.listForParticipant('ana')).length, 0, 'a formal request does not create a conversation');
  assert.equal((await inbox('ana')).length, 0, 'the student is not notified about their own request');
  assert.equal(await repo.getConfirmedAddress(v1.id, 'ana'), null);

  // ---- refusals
  assert.equal((await repo.requestViewing({ studentId: 'ana', propertyId: 'p1', start: '2026-11-03T10:00' })).ok, false, 'one open request per home');
  assert.ok(!(await repo.requestViewing({ studentId: 'ana', propertyId: 'own', start: '2026-11-03T10:00' })).ok);
  const past = await repo.requestViewing({ studentId: 'ana', propertyId: 'p2', start: '2026-10-31T09:00' });
  assert.ok(!past.ok && past.error.code === 'invalid');

  // ---- landlord confirms: the conversation is created automatically, with a status card and a notification
  assert.ok(!(await repo.respond(v1.id, 'ana', { type: 'confirm' })).ok, 'a student cannot act as the landlord');
  assert.ok(!(await repo.respond(v1.id, 'owner-2', { type: 'confirm' })).ok);
  const confirmed = await repo.respond(v1.id, 'owner-1', { type: 'confirm' });
  assert.ok(confirmed.ok && confirmed.value.status === 'confirmed');
  assert.equal(confirmed.ok && confirmed.value.proposals[0].outcome, 'accepted');
  assert.equal(confirmed.ok && confirmed.value.history[1].simulated, true, 'owner-side history is marked simulated');
  let convs = await conversations.listForParticipant('ana');
  assert.equal(convs.length, 1, 'a conversation now exists');
  assert.equal(convs[0].conversation.origin, 'viewing_update');
  assert.equal(convs[0].conversation.ownerId, 'owner-1');
  assert.equal(convs[0].lastMessage?.kind, 'viewing_event');
  assert.equal(convs[0].lastMessage?.eventCode, 'confirmed');
  assert.equal(convs[0].lastMessage?.eventStart, '2026-11-02T17:37');
  assert.equal(convs[0].lastMessage?.eventId, `${v1.id}:e2`);
  assert.equal(convs[0].unreadCount, 1, 'the student sees the landlord event as unread');
  let notes = await inbox('ana');
  assert.equal(notes.length, 1);
  assert.deepEqual([notes[0].kind, notes[0].entityId, notes[0].propertyId, notes[0].readAt, notes[0].simulated, notes[0].actionRequired], ['viewing_confirmed', v1.id, 'p1', null, true, false]);
  assert.ok(notes[0].body.includes('Home p1') && notes[0].body.includes('17:37'), 'identifies the property and the time');
  // the same event can never be posted or notified twice
  const again = await conversations.recordViewingEvent({ studentId: 'ana', ownerId: 'owner-1', propertyId: 'p1', listingPlanId: 'basic', viewingRequestId: v1.id, eventId: `${v1.id}:e2`, eventStart: '2026-11-02T17:37', relatedStart: null, status: 'confirmed', actorId: 'owner-1', code: 'confirmed', simulated: true, createIfMissing: true });
  assert.deepEqual(again, { posted: false, conversationId: convs[0].conversation.id, createdConversation: false });
  assert.equal((await conversations.listForParticipant('ana')).length, 1, 'no duplicate conversation');
  assert.equal((await inbox('ana')).length, 1, 'no duplicate notification');
  assert.equal(await repo.getConfirmedAddress(v1.id, 'ana'), 'Strada Fictivă 1, Bucharest');
  assert.equal(await repo.getConfirmedAddress(v1.id, 'bob'), null, 'only the student or owner may see it');
  assert.ok(!(await repo.respond(v1.id, 'owner-1', { type: 'confirm' })).ok, 'a repeated action does not repeat anything');
  assert.equal((await inbox('ana')).length, 1);
  assert.equal(bucketOf(confirmed.ok ? confirmed.value : v1, nowLocal()), 'upcoming');

  // ---- reschedule from confirmed: the agreed time stays in the history, the address hides again
  w.clock.advanceMinutes(5);
  const moved = await repo.reschedule(v1.id, 'ana', '2026-11-03T09:15');
  assert.ok(moved.ok);
  const v1b = moved.ok ? moved.value : v1;
  assert.equal(v1b.status, 'pending');
  assert.equal(originalRequestedStart(v1b), '2026-11-02T17:37', 'the original request never disappears');
  assert.equal(effectiveStart(v1b), '2026-11-03T09:15');
  assert.deepEqual(v1b.proposals.map((p) => [p.kind, p.outcome]), [['request', 'accepted'], ['reschedule', 'active']], 'the earlier agreed time keeps its outcome');
  assert.equal(await repo.getConfirmedAddress(v1.id, 'ana'), null);
  assert.equal(v1b.history.length, 3, 'history is only ever appended to');
  assert.equal((await conversations.listForParticipant('ana'))[0].lastMessage?.eventCode, 'rescheduled', 'the reschedule appears as a new card');
  assert.equal((await conversations.listForParticipant('ana')).length, 1, 'still one conversation');
  const rows = describeTimeline(v1b, nowLocal());
  assert.deepEqual(rows.map((r) => r.inactive), [true, false], 'the earlier time is shown as inactive');
  assert.ok(!(await repo.reschedule(v1.id, 'ana', '2026-10-31T10:00')).ok, 'a past time cannot be chosen');

  // ---- alternatives: all preserved, accepted / rejected recorded, student must accept explicitly
  const alt1 = await repo.respond(v1.id, 'owner-1', { type: 'propose_alternative', start: '2026-11-04T15:20' });
  assert.ok(alt1.ok && alt1.value.status === 'alternative_proposed' && effectiveStart(alt1.value) === '2026-11-04T15:20');
  assert.equal(alt1.ok && alt1.value.proposals[1].outcome, 'superseded');
  assert.ok(!(await repo.respond(v1.id, 'owner-1', { type: 'propose_alternative', start: '2026-11-04T15:20' })).ok, 'must differ from the current time');
  assert.ok(!(await repo.respond(v1.id, 'owner-1', { type: 'propose_alternative', start: '2026-10-30T15:20' })).ok, 'a past alternative is refused');
  notes = await inbox('ana');
  assert.equal(notes.length, 2);
  assert.deepEqual([notes[0].kind, notes[0].actionRequired], ['viewing_alternative_proposed', true], 'the student is told they need to decide');
  assert.equal(await repo.getConfirmedAddress(v1.id, 'ana'), null, 'proposing confirms nothing');
  assert.equal(bucketOf(alt1.ok ? alt1.value : v1, nowLocal()), 'pending', 'it waits for the student in the Pending tab');
  assert.ok(!(await repo.acceptAlternative(v1.id, 'bob')).ok, 'only the student can accept');
  // the landlord changes their mind: the first suggestion is replaced, not erased
  const alt2 = await repo.respond(v1.id, 'owner-1', { type: 'propose_alternative', start: '2026-11-05T16:45' });
  assert.ok(alt2.ok);
  assert.deepEqual((alt2.ok ? alt2.value : v1).proposals.map((p) => p.outcome), ['accepted', 'superseded', 'superseded', 'active']);
  // the student rejects it: their own last time is open again as a NEW proposal
  const rejected = await repo.rejectAlternative(v1.id, 'ana');
  assert.ok(rejected.ok && rejected.value.status === 'pending');
  const v1c = rejected.ok ? rejected.value : v1;
  assert.deepEqual(v1c.proposals.map((p) => [p.kind, p.proposedBy, p.outcome]), [['request', 'student', 'accepted'], ['reschedule', 'student', 'superseded'], ['alternative', 'owner', 'superseded'], ['alternative', 'owner', 'rejected'], ['retained', 'student', 'active']]);
  assert.equal(effectiveStart(v1c), '2026-11-03T09:15', 'their earlier requested time is live again');
  assert.equal(v1c.history.at(-1)?.event, 'alternative_rejected');
  assert.equal((await inbox('ana')).length, 3, 'the student rejecting is their own action: no new notification');
  assert.ok(!(await repo.rejectAlternative(v1.id, 'ana')).ok, 'there is nothing left to reject');
  // landlord proposes again; the student accepts: confirmed only now
  const alt3 = await repo.respond(v1.id, 'owner-1', { type: 'propose_alternative', start: '2026-11-06T11:11' });
  assert.ok(alt3.ok);
  const accepted = await repo.acceptAlternative(v1.id, 'ana');
  assert.ok(accepted.ok && accepted.value.status === 'confirmed' && effectiveStart(accepted.value) === '2026-11-06T11:11');
  const v1d = accepted.ok ? accepted.value : v1;
  assert.equal(currentProposal(v1d).outcome, 'accepted');
  assert.equal(v1d.proposals.length, 6, 'every time ever proposed is still there');
  assert.equal(await repo.getConfirmedAddress(v1.id, 'ana'), 'Strada Fictivă 1, Bucharest');
  const timeline = describeTimeline(v1d, nowLocal());
  assert.deepEqual(timeline.map((r) => r.inactive), [true, true, true, true, true, false], 'only the agreed time is active');
  assert.deepEqual(timeline.map((r) => r.outcome), ['accepted', 'superseded', 'superseded', 'rejected', 'superseded', 'accepted']);
  assert.ok(timeline.every((r) => !r.past));
  const events = v1d.history.map((h) => h.event);
  assert.deepEqual(events, ['requested', 'confirmed', 'rescheduled', 'alternative_proposed', 'alternative_proposed', 'alternative_rejected', 'alternative_proposed', 'alternative_accepted']);
  assert.equal(new Set(v1d.history.map((h) => h.id)).size, v1d.history.length, 'history ids are unique and stable');
  // every event is a separate card in the one conversation, and landlord events notified once each
  const thread = await conversations.getThread((await conversations.listForParticipant('ana'))[0].conversation.id, 'ana');
  assert.ok(thread.ok);
  assert.deepEqual(thread.ok ? thread.value.messages.map((m) => m.eventCode) : [], events.slice(1), 'one card per event from the landlord\'s confirmation on, in order, none duplicated (the initial request pre-dates the conversation and is not back-filled)');
  assert.equal((await inbox('ana')).length, 4, 'one for the confirmation and one per landlord alternative; none for the student\'s own actions');

  // ---- past times are disabled and not actionable
  w.clock.set(new Date(2026, 9, 31, 10, 0));
  const second = await repo.requestViewing({ studentId: 'ana', propertyId: 'p2', start: '2026-11-04T11:00' });
  assert.ok(second.ok);
  const id2 = second.ok ? second.value.id : '';
  const prop = await repo.respond(id2, 'owner-2', { type: 'propose_alternative', start: '2026-11-05T15:00' });
  assert.ok(prop.ok);
  assert.equal((await conversations.listForParticipant('ana')).length, 2, 'a second home gets its own conversation, created by the proposal');
  w.clock.set(new Date(2026, 10, 6, 9, 0)); // after the proposed time
  assert.ok(!(await repo.acceptAlternative(id2, 'ana')).ok, 'a past proposed time cannot be accepted');
  const stale = await get(id2);
  assert.equal(bucketOf(stale.value, nowLocal()), 'past');
  assert.equal(statusLabel(stale.value, nowLocal()), 'Expired');
  const staleRows = describeTimeline(stale.value, nowLocal());
  assert.ok(staleRows.every((r) => r.past && r.inactive), 'all past times are disabled');
  assert.ok(!(await repo.respond(id2, 'owner-2', { type: 'confirm' })).ok);
  assert.ok(!(await repo.respond(id2, 'owner-2', { type: 'propose_alternative', start: '2026-11-05T16:00' })).ok);
  w.clock.set(new Date(2026, 9, 31, 10, 0));

  // ---- decline / cancel / complete
  const third = await repo.requestViewing({ studentId: 'ana', propertyId: 'p2', start: '2026-12-01T10:00' });
  assert.ok(third.ok === false, 'the second home still has an open request');
  const cancelled = await repo.cancel(id2, 'ana');
  assert.ok(cancelled.ok && cancelled.value.status === 'cancelled');
  assert.deepEqual((cancelled.ok ? cancelled.value : stale.value).proposals.map((p) => p.outcome), ['superseded', 'rejected'], 'a cancelled landlord suggestion is recorded as rejected');
  assert.ok(!(await repo.cancel(id2, 'ana')).ok, 'terminal states cannot change');
  const retry = await repo.requestViewing({ studentId: 'ana', propertyId: 'p2', start: '2026-12-01T10:00' });
  assert.ok(retry.ok);
  const declined = await repo.respond(retry.ok ? retry.value.id : '', 'owner-2', { type: 'decline' });
  assert.ok(declined.ok && declined.value.status === 'declined' && declined.value.proposals[0].outcome === 'rejected');
  assert.equal((await inbox('ana')).filter((n) => n.kind === 'viewing_declined').length, 1);
  assert.ok(!(await repo.respond(v1.id, 'owner-1', { type: 'complete' })).ok, 'cannot complete before it happens');
  w.clock.set(new Date(2026, 10, 7, 9, 0));
  const done = await repo.respond(v1.id, 'owner-1', { type: 'complete' });
  assert.ok(done.ok && done.value.status === 'completed' && done.value.proposals.at(-1)?.outcome === 'accepted');
  assert.equal(canRevealAddress(done.ok ? done.value : v1), false);
  assert.equal(isActive(done.ok ? done.value : v1, nowLocal()), false);
  w.clock.set(new Date(2026, 9, 31, 10, 0));

  // ---- deep link: the right tab and the exact viewing
  const all = await repo.listForStudent('ana');
  assert.deepEqual(viewingHref('abc'), { pathname: '/my-viewings', params: { viewingId: 'abc' } });
  assert.equal(resolveViewingFocus(all, 'nope', nowLocal()).found, false);
  assert.equal(resolveViewingFocus(all, undefined, nowLocal()).found, false);
  const f1 = resolveViewingFocus(all, v1.id, nowLocal());
  assert.ok(f1.found && f1.viewing.id === v1.id, 'opens the exact viewing, not just the list');
  assert.equal(f1.found && f1.tab, 'past', 'a completed viewing belongs to Past');
  const fresh = await repo.requestViewing({ studentId: 'ana', propertyId: 'p1', start: '2026-11-20T10:30' });
  assert.ok(fresh.ok);
  const fid = fresh.ok ? fresh.value.id : '';
  const f2 = resolveViewingFocus(await repo.listForStudent('ana'), fid, nowLocal());
  assert.equal(f2.found && f2.tab, 'pending');
  await repo.respond(fid, 'owner-1', { type: 'confirm' });
  const f3 = resolveViewingFocus(await repo.listForStudent('ana'), fid, nowLocal());
  assert.equal(f3.found && f3.tab, 'upcoming', 'the tab follows the viewing as it changes');
  const f4 = resolveViewingFocus(await repo.listForStudent('ana'), fid, '2026-11-21T09:00');
  assert.equal(f4.found && f4.tab, 'past', 'a confirmed viewing whose time has passed moves to Past');

  // ---- grouping and sorting
  const upcoming = sortForTab((await repo.listForStudent('ana')).filter((x) => bucketOf(x, nowLocal()) === 'upcoming'), 'upcoming');
  assert.ok(groupByDay(upcoming).every((g) => g.items.every((i) => effectiveStart(i).startsWith(g.date))));

  // ---- records saved by the first Step 3c build are converted on read (nothing a tester saved is lost)
  const legacyBase = { propertyId: 'p1', studentId: 'legacy', ownerId: 'owner-1', studentNote: null, createdAt: '2026-10-30T10:00:00.000Z', updatedAt: '2026-10-30T10:00:00.000Z', origin: 'property_detail', listingPlanId: 'basic', slotSource: 'mock' };
  const legacyEvent = (event: string, status: string) => ({ event, status, at: '2026-10-30T10:00:00.000Z', actorId: 'legacy', actorRole: 'student', start: '2026-11-08T10:00', simulated: false });
  await w.storage.write('viewings', [
    { ...legacyBase, id: 'L1', status: 'pending', requestedStart: '2026-11-08T10:00', proposedStart: null, confirmedStart: null, history: [legacyEvent('requested', 'pending')] },
    { ...legacyBase, id: 'L2', status: 'alternative_proposed', requestedStart: '2026-11-08T10:00', proposedStart: '2026-11-09T15:00', confirmedStart: null, history: [] },
    { ...legacyBase, id: 'L3', status: 'confirmed', requestedStart: '2026-11-08T10:00', proposedStart: null, confirmedStart: '2026-11-09T15:00', history: [] },
    { ...legacyBase, id: 'L4', status: 'cancelled', requestedStart: '2026-11-08T10:00', proposedStart: null, confirmedStart: null, history: [] },
    { ...legacyBase, id: 'BAD', status: 'pending', history: [] },
  ]);
  const legacy = await viewingStore.all();
  assert.deepEqual(legacy.map((v) => v.id), ['L1', 'L2', 'L3', 'L4'], 'a record with no time at all is dropped');
  const byId = Object.fromEntries(legacy.map((v) => [v.id, v]));
  assert.deepEqual([byId.L1.proposals.length, effectiveStart(byId.L1), byId.L1.proposals[0].outcome], [1, '2026-11-08T10:00', 'active']);
  assert.deepEqual(byId.L2.proposals.map((p) => p.outcome), ['superseded', 'active']);
  assert.equal(effectiveStart(byId.L2), '2026-11-09T15:00');
  assert.deepEqual(byId.L3.proposals.map((p) => p.outcome), ['superseded', 'accepted']);
  assert.equal(byId.L4.proposals[0].outcome, 'withdrawn');
  assert.equal(byId.L1.history[0].id, 'L1:e1', 'old history rows get stable ids');
  await w.storage.write('viewings', []);


  // ---- the date range is calculated from the clock (never hard-coded) and is two CALENDAR years
  assert.deepEqual(dateRange('2026-11-02'), { min: '2026-11-02', max: '2028-11-02' });
  assert.deepEqual(dateRange('2027-06-15'), { min: '2027-06-15', max: '2029-06-15' }, 'it moves forward as time passes');
  assert.deepEqual(dateRange('2030-01-31'), { min: '2030-01-31', max: '2032-01-31' });
  assert.equal(addYears('2028-02-29', 2), '2030-02-28', '29 February clamps in a non-leap year');
  assert.equal(addYears('2028-02-29', 4), '2032-02-29');
  assert.equal(isWithinDateRange('2028-11-02', '2026-11-02'), true);
  assert.equal(isWithinDateRange('2028-11-03', '2026-11-02'), false);
  assert.equal(isWithinDateRange('2026-11-01', '2026-11-02'), false, 'yesterday is out');
  // the viewing validator follows the same clock-based bound
  assert.equal(validateViewingTime('2028-10-31T09:00', '2026-10-31T10:00').ok, true);
  assert.equal(validateViewingTime('2028-11-01T09:00', '2026-10-31T10:00').ok, false);
  assert.equal(validateViewingTime('2028-11-01T09:00', '2026-11-01T10:00').ok, true, 'a day later, the limit has moved a day later');
  assert.deepEqual(bookableRange('2027-03-05T08:15'), dateRange('2027-03-05'), 'viewings and move-in dates share one range');

  // ---- status cards tell ONLY their own event (the scenario: 10 Nov -> proposed 12 Nov -> accepted -> rescheduled ...)
  w.properties.push(makeProperty('p3', 'owner-3'));
  w.clock.set(new Date(2026, 10, 2, 9, 0));
  const sc = await repo.requestViewing({ studentId: 'ana', propertyId: 'p3', start: '2026-11-10T14:00' });
  assert.ok(sc.ok);
  const sid = sc.ok ? sc.value.id : '';
  await repo.respond(sid, 'owner-3', { type: 'propose_alternative', start: '2026-11-12T16:00' });
  await repo.acceptAlternative(sid, 'ana');
  await repo.reschedule(sid, 'ana', '2026-11-15T09:30');
  await repo.respond(sid, 'owner-3', { type: 'propose_alternative', start: '2026-11-16T15:00' });
  await repo.rejectAlternative(sid, 'ana');
  const scConv = (await conversations.listForParticipant('ana')).find((c) => c.conversation.propertyId === 'p3')!;
  const scThread = await conversations.getThread(scConv.conversation.id, 'ana');
  assert.ok(scThread.ok);
  const cards = scThread.ok ? scThread.value.messages.filter((m) => m.kind === 'viewing_event') : [];
  const finalViewing = (await get(sid)).value;
  assert.deepEqual(cards.map((m) => m.eventCode), ['alternative_proposed', 'alternative_accepted', 'rescheduled', 'alternative_proposed', 'alternative_rejected']);
  assert.deepEqual(cards.map((m) => m.eventStart), ['2026-11-12T16:00', '2026-11-12T16:00', '2026-11-15T09:30', '2026-11-16T15:00', '2026-11-16T15:00'], 'each card keeps the time of ITS event');
  assert.deepEqual(cards.map((m) => m.eventRelatedStart), ['2026-11-10T14:00', '2026-11-10T14:00', '2026-11-12T16:00', '2026-11-15T09:30', '2026-11-15T09:30']);
  assert.deepEqual(cards.map((m) => m.eventStatus), ['alternative_proposed', 'confirmed', 'pending', 'alternative_proposed', 'pending']);
  assert.equal(effectiveStart(finalViewing), '2026-11-15T09:30', 'the viewing has moved on since those cards were written');
  assert.ok(cards.every((m) => m.eventStart !== effectiveStart(finalViewing) || m.eventCode === 'rescheduled'), 'no old card shows the latest time');
  // the cards and the viewing history tell the same story, event by event
  for (const m of cards) {
    const h = finalViewing.history.find((x) => x.id === m.eventId)!;
    assert.ok(h, 'every card points at a history event');
    assert.deepEqual([m.eventStart, m.eventRelatedStart, m.eventStatus, m.eventCode], [h.start, h.relatedStart, h.status, h.event]);
  }
  // what is shown on a card
  const lines = cards.map((m) => eventCardLines(eventCardSnapshot(m, finalViewing, cards)));
  assert.deepEqual(lines[0], { primary: '12 Nov · 16:00', secondary: 'Instead of 10 Nov · 14:00', status: 'Status then: New time proposed' });
  assert.deepEqual(lines[1], { primary: '12 Nov · 16:00', secondary: 'Instead of 10 Nov · 14:00', status: 'Status then: Confirmed' });
  assert.deepEqual(lines[2], { primary: '15 Nov · 09:30', secondary: 'Moved from 12 Nov · 16:00', status: 'Status then: Pending confirmation' });
  assert.deepEqual(lines[4], { primary: '16 Nov · 15:00', secondary: 'Your time 15 Nov · 09:30 is open again', status: 'Status then: Pending confirmation' });
  // a card never reads the viewing's CURRENT state: the same card gives the same answer whatever the viewing looks like now
  const otherViewing = { ...finalViewing, status: 'cancelled' as const, currentProposalId: finalViewing.proposals[0].id };
  assert.deepEqual(eventCardSnapshot(cards[1], otherViewing, cards), eventCardSnapshot(cards[1], finalViewing, cards));
  assert.deepEqual(eventCardSnapshot(cards[1], undefined, cards), eventCardSnapshot(cards[1], finalViewing, cards), 'it does not even need the viewing');
  // cards saved before snapshots existed are filled from that event's own HISTORY entry, never from the current times
  const stripped = cards.map((m) => ({ ...m, eventStart: null, eventRelatedStart: null, eventStatus: null }));
  assert.deepEqual(stripped.map((m) => eventCardSnapshot(m, finalViewing, stripped)), cards.map((m) => eventCardSnapshot(m, finalViewing, cards)), 'old cards recovered by event id');
  const veryOld = stripped.map((m) => ({ ...m, eventId: null }));
  assert.deepEqual(veryOld.map((m) => eventCardSnapshot(m, finalViewing, veryOld).start), cards.map((m) => m.eventStart), 'oldest cards (no event id) recovered by order, so the two alternative_proposed cards keep their own times');
  assert.equal(eventCardSnapshot(veryOld[0], undefined, veryOld).start, null, 'without any record it shows no time rather than a wrong one');
  assert.equal(new Set(cards.map((m) => m.eventId)).size, cards.length, 'event ids and de-duplication are unchanged');
  w.clock.set(new Date(2026, 9, 31, 10, 0));

  console.log('viewings: all checks passed');
})();
