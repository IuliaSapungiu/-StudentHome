/// <reference types="node" />
import assert from 'node:assert/strict';
import { createSubmitFlow } from './submitFlow';

// A stand-in for the real gate: allowed -> runs at once; otherwise "opens" verification and remembers the callback.
function setup(opts: { valid?: boolean; allowed?: boolean } = {}) {
  const state = { valid: opts.valid ?? true, allowed: opts.allowed ?? false, formValue: 'first', opened: 0, submissions: [] as string[], pending: null as null | (() => void), release: null as null | (() => void) };
  const flow = createSubmitFlow({
    validate: () => state.valid,
    gateRun: (cb) => {
      if (state.allowed) {
        cb();
        return true;
      }
      state.opened += 1; // the email screen or SMS sheet opens
      state.pending = cb;
      return false;
    },
    isAllowed: () => state.allowed,
    submit: () => {
      state.submissions.push(state.formValue); // reads the CURRENT form values when it runs
      return new Promise<void>((resolve) => { state.release = resolve; });
    },
  });
  const sheetVerified = () => { state.allowed = true; const cb = state.pending; state.pending = null; cb?.(); };
  return { state, flow, sheetVerified };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  // invalid form: errors only, nothing opens, nothing submits
  let s = setup({ valid: false });
  assert.equal(s.flow.press(), 'invalid');
  assert.deepEqual([s.state.opened, s.state.submissions.length], [0, 0], 'an invalid form never opens SMS / email verification');

  // valid but not verified: the verification opens ONCE, nothing is submitted yet
  s = setup();
  assert.equal(s.flow.press(), 'verifying');
  assert.deepEqual([s.state.opened, s.state.submissions.length], [1, 0]);
  s.state.formValue = 'edited while the sheet was open'; // the form stayed mounted: the latest values are used
  s.sheetVerified();
  assert.deepEqual(s.state.submissions, ['edited while the sheet was open'], 'after verification the form submits, with the values the student has now');
  // the records update right after the sheet reports success: still ONE submission
  s.flow.onAccessChanged();
  s.flow.onAccessChanged();
  assert.equal(s.state.submissions.length, 1, 'verification finishing twice never submits twice');
  s.state.release?.();
  await tick();

  // already verified: submits straight away, opens nothing
  s = setup({ allowed: true });
  assert.equal(s.flow.press(), 'submitted');
  assert.deepEqual([s.state.opened, s.state.submissions.length], [0, 1]);

  // a double tap while submitting does not submit twice
  assert.equal(s.flow.press(), 'submitted');
  assert.equal(s.state.submissions.length, 1, 'a second press while the first is running is ignored');
  s.state.release?.();
  await tick();

  // email path: no sheet callback, access changes later (records refreshed after the email screen)
  s = setup();
  s.flow.press();
  s.flow.onAccessChanged();
  assert.equal(s.state.submissions.length, 0, 'still not allowed: nothing happens');
  s.state.allowed = true;
  s.flow.onAccessChanged();
  assert.equal(s.state.submissions.length, 1, 'continues once the email is verified');
  s.flow.onAccessChanged();
  assert.equal(s.state.submissions.length, 1);

  // coming back without verifying means "never mind": later verification elsewhere does not submit by surprise
  s = setup();
  s.flow.press();
  s.flow.cancelIfNotAllowed();
  s.state.allowed = true;
  s.flow.onAccessChanged();
  assert.equal(s.state.submissions.length, 0);

  // a failed or finished submission can be pressed again later (the screen decides what to show)
  s = setup({ allowed: true });
  s.flow.press();
  s.state.release?.();
  await tick();
  s.flow.press();
  assert.equal(s.state.submissions.length, 2);

  console.log('submitFlow: all checks passed');
})();
