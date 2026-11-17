import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../session/SessionProvider';
import { useVerification } from './VerificationProvider';
import { createSubmitFlow } from './submitFlow';
import { useVerifiedActionGate } from './useVerifiedActionGate';
import { getAccessDecision, type GatedAction } from './verificationRules';

/**
 * Submits a form once the person is allowed to do `action`, in this order: validate the form (invalid ->
 * errors only, no verification prompt), then the existing gate (guest / email screen / SMS sheet), then submit,
 * exactly once. It resumes after the email screen or SMS sheet, and does nothing if the person comes back
 * without verifying. Render `sheet` once in the screen. See submitFlow.ts for the rules.
 */
export function useGatedSubmit(action: GatedAction, submit: () => void | Promise<void>, validate: () => boolean = () => true): { trigger: () => void; sheet: ReactNode } {
  const gate = useVerifiedActionGate(action);
  const { user } = useSession();
  const { records } = useVerification();
  const allowed = getAccessDecision(action, { user, records }).allowed;

  // The flow is created once and always reads the latest values, so it never acts on stale form data.
  const latest = useRef({ validate, submit, run: gate.run, allowed });
  latest.current = { validate, submit, run: gate.run, allowed };
  const flow = useMemo(
    () => createSubmitFlow({ validate: () => latest.current.validate(), gateRun: (cb) => latest.current.run(cb), isAllowed: () => latest.current.allowed, submit: () => latest.current.submit() }),
    [],
  );

  useEffect(() => {
    flow.onAccessChanged();
  }, [allowed, flow]);
  useFocusEffect(useCallback(() => flow.cancelIfNotAllowed(), [flow]));

  const trigger = useCallback(() => {
    flow.press();
  }, [flow]);
  return { trigger, sheet: gate.sheet };
}
