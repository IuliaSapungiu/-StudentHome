/**
 * The order of a gated form submission, kept free of React so it can be tested:
 *   1. validate the form FIRST. If it is invalid, show the errors and open nothing (no email or SMS prompt);
 *   2. only then ask the existing gate to run. If access is already allowed the submission starts at once; if
 *      not, the gate shows its email screen or SMS sheet, and the submission continues after verification;
 *   3. each press is one attempt and starts the submission at most once, however many signals arrive
 *      (the SMS sheet finishing, the verification records updating, a second tap).
 * The form values live in the screen, which stays mounted under the verification screen or sheet, so they survive.
 */
export type PressResult = 'invalid' | 'submitted' | 'verifying';

export function createSubmitFlow(deps: {
  validate: () => boolean;
  /** The existing gate: runs the callback now and returns true when allowed, otherwise opens verification and returns false. */
  gateRun: (onAllowed: () => void) => boolean;
  isAllowed: () => boolean;
  submit: () => void | Promise<void>;
}) {
  let attempt = 0;
  let waiting: number | null = null; // the attempt waiting for verification
  let inFlight = false;

  const fire = (id: number) => {
    if (waiting !== id) return; // this attempt was already started, or cancelled
    waiting = null;
    if (inFlight) return; // a submission is already running: never start a second one
    inFlight = true;
    Promise.resolve(deps.submit()).finally(() => {
      inFlight = false;
    });
  };

  return {
    press(): PressResult {
      if (!deps.validate()) return 'invalid';
      const id = ++attempt;
      waiting = id;
      const ranNow = deps.gateRun(() => fire(id));
      return ranNow ? 'submitted' : 'verifying';
    },
    /** Call when the verification records change: continues a waiting attempt once access is allowed. */
    onAccessChanged(): void {
      if (waiting !== null && deps.isAllowed()) fire(waiting);
    },
    /** Call when the person comes back without having verified: "never mind". */
    cancelIfNotAllowed(): void {
      if (!deps.isAllowed()) waiting = null;
    },
  };
}
