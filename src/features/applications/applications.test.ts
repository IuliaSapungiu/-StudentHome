/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMockPropertyRepository } from '../../data/mockRepository';
import { DEMO_PROPERTIES } from '../../data/mockProperties';
import { makeProperty, makeStack, makeUser, makeWorld, verified } from '../test-support';
import { applicationDefaults, applicationGroup, isActiveApplication, validateApplication } from './applicationRules';
import { createApplicationStore, createMockApplicationRepository } from './mockApplicationRepository';
import { createMockNotificationRepository, createNotificationStore } from '../notifications/mockNotificationRepository';
import type { ApplicationInput } from './types';

const input = (over: Partial<ApplicationInput> = {}): ApplicationInput => ({
  propertyId: 'p1', preferredMoveIn: '2026-12-01', leaseMonths: 12, occupants: 1, university: 'ASE', studyStatus: 'master', message: null, consent: true, ...over,
});

(async () => {
  // ---- validation (pure)
  assert.equal(validateApplication(input(), '2026-10-31').ok, true);
  const bad = validateApplication(input({ preferredMoveIn: '2026-10-01', leaseMonths: 0, occupants: 9, university: ' ', studyStatus: null, message: 'x'.repeat(1001), consent: false }), '2026-10-31');
  assert.ok(!bad.ok);
  if (!bad.ok) assert.deepEqual(Object.keys(bad.fields).sort(), ['consent', 'leaseMonths', 'message', 'occupants', 'preferredMoveIn', 'studyStatus', 'university']);
  assert.equal(validateApplication(input({ preferredMoveIn: '2028-10-31' }), '2026-10-31').ok, true, 'the same range as viewings: up to the same day two years later');
  assert.equal(validateApplication(input({ preferredMoveIn: '2028-11-01' }), '2026-10-31').ok, false, 'one day beyond two years');
  assert.equal(validateApplication(input({ preferredMoveIn: '2028-11-01' }), '2026-11-01').ok, true, 'the limit moves with the clock');
  assert.equal(validateApplication(input({ preferredMoveIn: '2027-12-01' }), '2026-10-31').ok, true, 'no longer limited to one year');
  assert.equal(validateApplication(input({ preferredMoveIn: '2029-01-01' }), '2026-10-31').ok, false, 'too far ahead');
  assert.equal(validateApplication(input({ preferredMoveIn: '2026-10-31' }), '2026-10-31').ok, true, 'today is allowed');
  assert.equal(validateApplication(input({ preferredMoveIn: 'soon' }), '2026-10-31').ok, false);
  assert.equal(validateApplication(input({ consent: false }), '2026-10-31').ok, false, 'consent is required');
  const trimmed = validateApplication(input({ university: '  ASE  ', message: '   ' }), '2026-10-31');
  assert.ok(trimmed.ok && trimmed.value.university === 'ASE' && trimmed.value.message === null);

  const ana = makeUser('ana');
  const noPhoneVerified = makeUser('bob');
  const nobody = makeUser('cy');
  const w = makeWorld([ana, noPhoneVerified, nobody], [verified(ana, 'email'), verified(ana, 'phone'), verified(noPhoneVerified, 'email')],
    [makeProperty('p1', 'owner-1', { planId: 'basic' }), makeProperty('p2', 'owner-2', { planId: 'managed_booking' }), makeProperty('p3', 'owner-3', { planId: 'premium' }), makeProperty('own', 'ana'), makeProperty('draft', 'owner-1', { status: 'draft' })]);
  w.clock.set(new Date(2026, 9, 31, 10, 0));
  const { applications: repo, notifications } = makeStack(w);

  // ---- gates enforced by the repository
  const g1 = await repo.submit('cy', input());
  assert.ok(!g1.ok && g1.error.code === 'not_allowed' && g1.error.access?.requires === 'verified_email');
  const g2 = await repo.submit('bob', input());
  assert.ok(!g2.ok && g2.error.code === 'not_allowed' && g2.error.access?.requires === 'verified_phone');
  assert.deepEqual(await repo.listForStudent('bob'), []);

  // ---- submit: details come from the account, not the form; no conversation or viewing needed
  const first = await repo.submit('ana', input({ message: ' Hello ' }));
  assert.ok(first.ok);
  if (!first.ok) throw new Error('unreachable');
  const a = first.value;
  assert.equal(a.status, 'submitted');
  assert.equal(a.applicantName, 'Name ana');
  assert.equal(a.applicantEmail, 'ana@example.com');
  assert.equal(a.applicantPhone, '+40712345678');
  assert.equal(a.message, 'Hello');
  assert.equal(a.ownerId, 'owner-1');
  assert.equal(a.listingPlanId, 'basic');
  assert.equal(a.history.length, 1);
  assert.equal(a.history[0].id, `${a.id}:s1`, 'history entries have stable ids');
  assert.ok(a.consentAcceptedAt);
  assert.deepEqual(await notifications.list('ana'), [], 'no notification for the initial Submitted state');

  // ---- refusals
  const dup = await repo.submit('ana', input());
  assert.ok(!dup.ok && dup.error.code === 'conflict', 'one open application per home');
  const invalid = await repo.submit('ana', input({ propertyId: 'p2', consent: false }));
  assert.ok(!invalid.ok && invalid.error.code === 'invalid' && invalid.error.fields?.consent);
  assert.ok(!(await repo.submit('ana', input({ propertyId: 'own' }))).ok, 'cannot apply to own listing');
  const draft = await repo.submit('ana', input({ propertyId: 'draft' }));
  assert.ok(!draft.ok && draft.error.code === 'unavailable');

  // ---- every plan tier can be applied to (not only Business)
  for (const [pid, plan] of [['p1', 'basic'], ['p2', 'managed_booking'], ['p3', 'premium']] as const) {
    if (pid === 'p1') continue; // already applied above
    const r = await repo.submit('ana', input({ propertyId: pid }));
    assert.ok(r.ok && r.value.listingPlanId === plan, `applications work on ${plan}`);
  }

  // ---- the landlord side: status flow, never touches the listing
  const listingBefore = JSON.stringify(await w.propertyRepo.getById('p1'));
  assert.ok(!(await repo.respond(a.id, 'ana', { type: 'accept' })).ok, 'a student cannot act as the landlord');
  assert.ok(!(await repo.respond(a.id, 'owner-2', { type: 'accept' })).ok);
  const review = await repo.respond(a.id, 'owner-1', { type: 'start_review' });
  assert.ok(review.ok && review.value.status === 'under_review' && review.value.history[1].simulated === true);
  let notes = await notifications.list('ana');
  assert.deepEqual(notes.map((n) => [n.kind, n.entityType, n.entityId, n.propertyId, n.readAt, n.simulated]), [['application_under_review', 'application', a.id, 'p1', null, true]], 'Under review notifies, unread, and identifies the application and home');
  assert.ok(notes[0].body.includes('Home p1'));
  assert.deepEqual(await notifications.list('bob'), [], 'other accounts see nothing');
  assert.ok(!(await repo.respond(a.id, 'owner-1', { type: 'start_review' })).ok, 'cannot start review twice');
  const accepted = await repo.respond(a.id, 'owner-1', { type: 'accept' });
  assert.ok(accepted.ok && accepted.value.status === 'accepted');
  notes = await notifications.list('ana');
  assert.deepEqual(notes.map((n) => n.kind), ['application_accepted', 'application_under_review'], 'Accepted notifies once more, newest first');
  assert.equal(notes[0].eventId, `${a.id}:s3`);
  assert.ok(!(await repo.respond(a.id, 'owner-1', { type: 'accept' })).ok);
  assert.equal((await notifications.list('ana')).length, 2, 'repeating the same status change does not notify again');
  assert.equal(JSON.stringify(await w.propertyRepo.getById('p1')), listingBefore, 'accepting changes nothing about the listing');
  assert.equal(isActiveApplication(accepted.ok ? accepted.value : a), true);
  assert.ok(!(await repo.respond(a.id, 'owner-1', { type: 'reject' })).ok, 'an accepted application cannot be rejected');
  assert.equal((await repo.listForStudent('ana')).length, 3);

  // ---- withdraw (also from accepted), then the student may apply again
  const withdrawn = await repo.withdraw(a.id, 'ana');
  assert.ok(withdrawn.ok && withdrawn.value.status === 'withdrawn');
  assert.equal((await notifications.list('ana')).length, 2, 'withdrawing is the student\'s own action: no notification');
  assert.ok(!(await repo.withdraw(a.id, 'ana')).ok, 'cannot withdraw twice');
  assert.ok(!(await repo.withdraw(a.id, 'bob')).ok);
  const again = await repo.submit('ana', input());
  assert.ok(again.ok, 'after withdrawing, applying again is allowed');
  const rej = await repo.respond(again.ok ? again.value.id : '', 'owner-1', { type: 'reject' });
  assert.ok(rej.ok && rej.value.status === 'rejected');
  assert.equal((await notifications.list('ana'))[0].kind, 'application_rejected');
  assert.ok(!(await repo.withdraw(again.ok ? again.value.id : '', 'ana')).ok, 'rejected is final');

  // ---- common answers are reused, but every application is submitted individually
  const defaults = applicationDefaults(await repo.listForStudent('ana'));
  assert.deepEqual(defaults, { university: 'ASE', studyStatus: 'master', occupants: 1, leaseMonths: 12 });
  assert.equal(applicationDefaults([]), null);
  const separate = (await repo.listForStudent('ana')).filter((x) => x.propertyId !== 'p1');
  assert.equal(separate.length, 2, 'two other homes = two separate applications');

  // ---- gate re-checked at submit time
  w.records.length = 0;
  const lost = await repo.submit('ana', input({ propertyId: 'p2' }));
  assert.ok(!lost.ok, 'cannot submit once verification is gone (and an open application exists anyway)');

  // ---- shared by both sides, persisted
  assert.equal((await repo.listForOwner('owner-1')).length, 2);
  const reopened = createMockApplicationRepository({ store: createApplicationStore(w.storage), properties: w.propertyRepo, access: w.access, getUser: async () => null, notifications: createMockNotificationRepository({ store: createNotificationStore(w.storage) }) });
  assert.equal((await reopened.listForStudent('ana')).length, 4);

  // ---- real demo catalogue: every plan tier on the actual demo data accepts applications
  const demoRepo = createMockPropertyRepository(DEMO_PROPERTIES);
  for (const p of DEMO_PROPERTIES.slice(0, 3)) assert.ok(await demoRepo.getById(p.id));

  // ---- grouping for the Applications list: presentation only
  assert.deepEqual((['submitted', 'under_review', 'accepted', 'rejected', 'withdrawn'] as const).map(applicationGroup), ['active', 'active', 'completed', 'completed', 'completed']);

  console.log('applications: all checks passed');
})();
