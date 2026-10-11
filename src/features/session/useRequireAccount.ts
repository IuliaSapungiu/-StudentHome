import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from './SessionProvider';

/**
 * Gate for account-only actions (save, message, request a viewing, ...).
 * Signed in: runs the action. Guest: opens the "Create an account to continue" screen.
 */
export function useRequireAccount() {
  const { isSignedIn } = useSession();
  const router = useRouter();
  return useCallback(
    (action?: () => void): boolean => {
      if (isSignedIn) {
        action?.();
        return true;
      }
      router.push('/account-required');
      return false;
    },
    [isSignedIn, router],
  );
}
