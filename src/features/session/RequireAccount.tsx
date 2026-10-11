import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { useSession } from './SessionProvider';

// Screen-level guard (covers deep links; tab presses are intercepted in the tab layout).
export function RequireAccount({ children }: { children: ReactNode }) {
  const { status, isSignedIn } = useSession();
  if (status === 'loading') return null;
  if (!isSignedIn) return <Redirect href="/account-required" />;
  return <>{children}</>;
}
