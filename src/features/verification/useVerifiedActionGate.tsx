import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { PhoneVerificationSheet } from '@/components/PhoneVerificationSheet';
import { useSession } from '../session/SessionProvider';
import { useVerification } from './VerificationProvider';
import { getAccessDecision, type GatedAction } from './verificationRules';

/**
 * Gate for actions that need a verified email (and, for viewing requests / rental applications, an
 * SMS-verified phone the first time). Render `sheet` once in the screen.
 *   const gate = useVerifiedActionGate('request_viewing');
 *   <Button onPress={() => gate.run(() => sendRequest())} />  {gate.sheet}
 * Guest -> account screen. Unverified email -> verify-email screen. Unverified phone -> SMS sheet.
 * Already verified -> the action runs, with no further SMS.
 */
export function useVerifiedActionGate(action: GatedAction): { run: (onAllowed: () => void) => boolean; sheet: ReactNode } {
  const { user } = useSession();
  const { records } = useVerification();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const run = useCallback(
    (onAllowed: () => void) => {
      const decision = getAccessDecision(action, { user, records });
      if (decision.allowed) {
        onAllowed();
        return true;
      }
      if (decision.requires === 'account') router.push('/account-required');
      else if (decision.requires === 'verified_email') router.push({ pathname: '/verify-email', params: { reason: action } });
      else {
        pending.current = onAllowed;
        setSheetOpen(true);
      }
      return false;
    },
    [action, user, records, router],
  );

  const sheet = (
    <PhoneVerificationSheet
      visible={sheetOpen}
      onClose={() => setSheetOpen(false)}
      onVerified={() => {
        setSheetOpen(false);
        const next = pending.current;
        pending.current = null;
        next?.();
      }}
    />
  );
  return { run, sheet };
}
