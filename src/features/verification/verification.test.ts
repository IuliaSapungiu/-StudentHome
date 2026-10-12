/// <reference types="node" />
import assert from 'node:assert/strict';
import { createDemoVerificationControls } from '../../demo/demoVerificationControls';
import { createMemoryKeyValue, createMockStorage } from '../../storage/keyValue';
import { createUser } from '../session/sessionLogic';
import { createMockVerificationService, DEMO_OTP_CODE, DEMO_OTP_SERVICE_ERROR_CODE, type MockVerificationOutcomes } from './mockVerificationService';
import { createMockVerificationStore } from './mockVerificationStore';
import { effectiveContactStatus, findRecord, getAccessDecision, isEmailVerified, isPhoneVerified, OTP_RULES, resendWaitMs, statusOf } from './verificationRules';
import type { VerificationRecord } from './types';

const rec = (over: Partial<VerificationRecord>): VerificationRecord => ({
  id: 'r', userId: 'u1', kind: 'email', subjectId: null, status: 'verified', value: null, reason: null, updatedAt: '2026-10-12T00:00:00.000Z', simulated: true, ...over,
});
const student = createUser('s@x.com', 'student', 'u1', { fullName: 'Stu Dent', phone: '+40712345678' });

(async () => {
  // ---- statuses and "value must match"
  assert.equal(statusOf([], 'u1', 'email'), 'not_started');
  const emailOk = [rec({ kind: 'email', value: 's@x.com' })];
  assert.equal(isEmailVerified(emailOk, student), true);
  assert.equal(isEmailVerified([rec({ kind: 'email', value: 'other@x.com' })], student), false);
  assert.equal(isEmailVerified([rec({ kind: 'email', value: 's@x.com', status: 'pending' })], student), false);
  const phoneOk = [rec({ kind: 'phone', value: '+40712345678' })];
  assert.equal(isPhoneVerified(phoneOk, student), true);
  // changing the phone number invalidates the old verification, with no extra flag to maintain
  const changed = { ...student, phone: '+40799999999' };
  assert.equal(isPhoneVerified(phoneOk, changed), false);
  assert.equal(effectiveContactStatus(phoneOk, changed, 'phone'), 'not_started');
  assert.equal(effectiveContactStatus(phoneOk, student, 'phone'), 'verified');
  assert.equal(isPhoneVerified(phoneOk, { ...student, phone: null }), false);

  // ---- kinds are independent
  const mixed = [rec({ kind: 'identity', status: 'verified' }), rec({ kind: 'property', subjectId: 'p1', status: 'rejected' })];
  assert.equal(statusOf(mixed, 'u1', 'identity'), 'verified');
  assert.equal(statusOf(mixed, 'u1', 'company'), 'not_started');
  assert.equal(statusOf(mixed, 'u1', 'email'), 'not_started');
  assert.equal(statusOf(mixed, 'u1', 'property', 'p1'), 'rejected');
  assert.equal(statusOf(mixed, 'u1', 'property', 'p2'), 'not_started');
  assert.equal(findRecord(mixed, 'u2', 'identity'), undefined);

  // ---- access rules
  const none: VerificationRecord[] = [];
  assert.deepEqual(getAccessDecision('save', { user: null, records: none }), { allowed: false, requires: 'account' });
  assert.deepEqual(getAccessDecision('message', { user: null, records: none }), { allowed: false, requires: 'account' });
  assert.deepEqual(getAccessDecision('save', { user: student, records: none }), { allowed: true }); // saving needs no verification
  assert.deepEqual(getAccessDecision('message', { user: student, records: none }), { allowed: false, requires: 'verified_email', status: 'not_started' });
  assert.deepEqual(getAccessDecision('message', { user: student, records: emailOk }), { allowed: true }); // no phone needed to message
  assert.equal((getAccessDecision('request_viewing', { user: student, records: none }) as { requires: string }).requires, 'verified_email'); // email comes first
  assert.deepEqual(getAccessDecision('request_viewing', { user: student, records: emailOk }), { allowed: false, requires: 'verified_phone', status: 'not_started', hasPhone: true });
  assert.deepEqual(getAccessDecision('rental_application', { user: student, records: emailOk }), { allowed: false, requires: 'verified_phone', status: 'not_started', hasPhone: true });
  assert.equal((getAccessDecision('request_viewing', { user: { ...student, phone: null }, records: emailOk }) as { hasPhone: boolean }).hasPhone, false);
  const both = [...emailOk, ...phoneOk];
  for (let i = 0; i < 3; i++) assert.deepEqual(getAccessDecision('request_viewing', { user: student, records: both }), { allowed: true }); // no repeat SMS
  assert.deepEqual(getAccessDecision('rental_application', { user: student, records: both }), { allowed: true });
  assert.equal((getAccessDecision('request_viewing', { user: changed, records: both }) as { requires: string }).requires, 'verified_phone'); // new number

  // ---- mock service with a fake clock
  const setup = (enabled = true) => {
    const kv = createMemoryKeyValue();
    const store = createMockVerificationStore(createMockStorage(kv));
    const outcomes: MockVerificationOutcomes = { smsDelivery: 'ok' };
    let t = 1_000_000;
    const service = createMockVerificationService({ store, enabled: () => enabled, outcomes, now: () => t });
    return { store, outcomes, service, advance: (ms: number) => { t += ms; } };
  };

  // the service exposes no way to set a status
  assert.deepEqual(Object.keys(setup().service).sort(), ['confirmPhoneCode', 'requestEmailVerification', 'simulated', 'startPhoneVerification']);
  assert.equal(setup().service.simulated, true);

  // email: pending + simulated, then throttled
  {
    const { service, store, advance } = setup();
    assert.equal((await service.requestEmailVerification(student)).ok, true);
    let rows = await store.listForUser('u1');
    assert.deepEqual([rows[0].kind, rows[0].status, rows[0].simulated, rows[0].value], ['email', 'pending', true, 's@x.com']);
    const again = await service.requestEmailVerification(student);
    assert.ok(!again.ok && again.error.code === 'cooldown' && (again.error.retryAfterMs ?? 0) > 0);
    advance(OTP_RULES.resendCooldownMs + 1);
    assert.equal((await service.requestEmailVerification(student)).ok, true);
  }

  // phone: happy path
  {
    const { service, store } = setup();
    const start = await service.startPhoneVerification(student);
    assert.ok(start.ok && /Demo only/.test(start.value.demoHint ?? ''));
    assert.equal((await store.listForUser('u1')).find((r) => r.kind === 'phone')?.status, 'pending');
    assert.equal((await service.confirmPhoneCode(student, DEMO_OTP_CODE)).ok, true);
    const row = (await store.listForUser('u1')).find((r) => r.kind === 'phone');
    assert.deepEqual([row?.status, row?.value, row?.simulated], ['verified', '+40712345678', true]);
  }
  // phone: wrong codes, lockout, recovery
  {
    const { service, advance } = setup();
    await service.startPhoneVerification(student);
    const first = await service.confirmPhoneCode(student, '111111');
    assert.ok(!first.ok && first.error.code === 'invalid_code' && /4 tries left/.test(first.error.message));
    for (let i = 0; i < 3; i++) await service.confirmPhoneCode(student, '111111');
    const fifth = await service.confirmPhoneCode(student, '111111');
    assert.ok(!fifth.ok && fifth.error.code === 'locked');
    const rightButLocked = await service.confirmPhoneCode(student, DEMO_OTP_CODE);
    assert.ok(!rightButLocked.ok && rightButLocked.error.code === 'locked'); // even the right code is refused while locked
    const restart = await service.startPhoneVerification(student);
    assert.ok(!restart.ok && restart.error.code === 'locked');
    advance(OTP_RULES.lockMs + 1);
    assert.equal((await service.startPhoneVerification(student)).ok, true);
    assert.equal((await service.confirmPhoneCode(student, DEMO_OTP_CODE)).ok, true);
  }
  // phone: resend cooldown, expiry, no challenge, service error, SMS delivery failure, missing phone
  {
    const { service, store, advance, outcomes } = setup();
    assert.ok(!(await service.confirmPhoneCode(student, DEMO_OTP_CODE)).ok);
    await service.startPhoneVerification(student);
    const early = await service.startPhoneVerification(student);
    assert.ok(!early.ok && early.error.code === 'cooldown');
    advance(OTP_RULES.ttlMs + 1);
    const late = await service.confirmPhoneCode(student, DEMO_OTP_CODE);
    assert.ok(!late.ok && late.error.code === 'expired');
    assert.equal((await service.startPhoneVerification(student)).ok, true);
    const err = await service.confirmPhoneCode(student, DEMO_OTP_SERVICE_ERROR_CODE);
    assert.ok(!err.ok && err.error.code === 'service_error');
    assert.equal((await store.listForUser('u1')).find((r) => r.kind === 'phone')?.status, 'failed');
    outcomes.smsDelivery = 'fail';
    advance(OTP_RULES.resendCooldownMs + 1);
    const undelivered = await service.startPhoneVerification(student);
    assert.ok(!undelivered.ok && undelivered.error.code === 'delivery_failed');
    const noPhone = await service.startPhoneVerification({ ...student, phone: null });
    assert.ok(!noPhone.ok && noPhone.error.code === 'no_phone');
  }
  // a code for the old number does not carry over after the number changes
  {
    const { service } = setup();
    await service.startPhoneVerification(student);
    const r = await service.confirmPhoneCode({ ...student, phone: '+40799999999' }, DEMO_OTP_CODE);
    assert.ok(!r.ok && r.error.code === 'no_challenge');
  }
  // disabled (e.g. a release build without the demo flag): nothing works, nothing is written
  {
    const { service, store } = setup(false);
    for (const r of [await service.requestEmailVerification(student), await service.startPhoneVerification(student), await service.confirmPhoneCode(student, DEMO_OTP_CODE)]) {
      assert.ok(!r.ok && r.error.code === 'unavailable');
    }
    assert.equal((await store.listForUser('u1')).length, 0);
  }

  // ---- demo simulator (development only)
  {
    const kv = createMemoryKeyValue();
    const store = createMockVerificationStore(createMockStorage(kv));
    let enabled = false;
    const controls = createDemoVerificationControls({ store, enabled: () => enabled });
    assert.equal(await controls.setStatus('u1', 'identity', 'verified'), false); // refuses when disabled
    assert.equal(await controls.completeEmail(student), false);
    assert.equal(await controls.seedDemoAccount(student), false);
    assert.equal(await controls.reset('u1'), false);
    assert.equal((await store.listForUser('u1')).length, 0);

    enabled = true;
    for (const status of ['pending', 'verified', 'rejected', 'failed', 'more_info_required'] as const) {
      assert.equal(await controls.setStatus('u1', 'company', status), true);
      const row = (await store.listForUser('u1')).find((r) => r.kind === 'company');
      assert.equal(row?.status, status);
      assert.equal(row?.simulated, true); // always flagged as simulated
      if (['rejected', 'failed', 'more_info_required'].includes(status)) assert.ok(row?.reason);
    }
    // statuses are independent per kind and per subject
    await controls.setStatus('u1', 'identity', 'verified');
    await controls.setStatus('u1', 'property', 'pending', { subjectId: 'p1' });
    const rows = await store.listForUser('u1');
    assert.equal(statusOf(rows, 'u1', 'identity'), 'verified');
    assert.equal(statusOf(rows, 'u1', 'company'), 'more_info_required');
    assert.equal(statusOf(rows, 'u1', 'property', 'p1'), 'pending');
    assert.equal(statusOf(rows, 'u1', 'property', 'p2'), 'not_started');
    await controls.setStatus('u1', 'company', 'not_started'); // removes the record
    assert.equal(statusOf(await store.listForUser('u1'), 'u1', 'company'), 'not_started');

    // demo-account preset: email verified, phone not verified
    await controls.setStatus('u1', 'phone', 'verified', { value: student.phone });
    await controls.seedDemoAccount(student);
    const seeded = await store.listForUser('u1');
    assert.equal(isEmailVerified(seeded, student), true);
    assert.equal(isPhoneVerified(seeded, student), false);
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0].simulated, true);
    assert.deepEqual(getAccessDecision('request_viewing', { user: student, records: seeded }), { allowed: false, requires: 'verified_phone', status: 'not_started', hasPhone: true });

    await controls.completeEmail({ ...student, email: 'new@x.com' }, 'failed');
    assert.equal(effectiveContactStatus(await store.listForUser('u1'), { ...student, email: 'new@x.com' }, 'email'), 'failed');
    await controls.reset('u1');
    assert.equal((await store.listForUser('u1')).length, 0);
    assert.equal(resendWaitMs(null, 5), 0);
  }

  console.log('verification: all checks passed');
})();
