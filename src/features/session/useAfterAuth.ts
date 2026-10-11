import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { homeRouteFor } from './sessionLogic';
import type { MockUser } from './types';

/** After logging in or registering: close the auth screens and land in the user's active mode. */
export function useAfterAuth() {
  const router = useRouter();
  return useCallback(
    (user: MockUser) => {
      if (router.canDismiss()) router.dismissAll();
      if (user.activeMode === 'provider') router.replace(homeRouteFor('provider'));
    },
    [router],
  );
}
