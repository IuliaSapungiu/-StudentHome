import { useCallback, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useVerifiedActionGate } from '../verification/useVerifiedActionGate';
import type { ContactOrigin } from '../shared/attribution';
import { useMessaging } from './MessagingProvider';

/**
 * "Message landlord": runs the email gate, then opens the student's existing conversation for the home, or a
 * new draft one. Nothing is created until the first message is actually sent. Render `sheet` once in the screen.
 */
export function useOpenConversation(): { open: (propertyId: string, origin?: ContactOrigin) => void; sheet: ReactNode } {
  const router = useRouter();
  const { findForProperty } = useMessaging();
  const gate = useVerifiedActionGate('message');
  const { run } = gate;
  const open = useCallback(
    (propertyId: string, origin: ContactOrigin = 'property_detail') => {
      run(() => {
        void findForProperty(propertyId).then((existing) => {
          if (existing) router.push({ pathname: '/conversation/[id]', params: { id: existing.id } });
          else router.push({ pathname: '/conversation/[id]', params: { id: 'new', propertyId, origin } });
        });
      });
    },
    [run, findForProperty, router],
  );
  return { open, sheet: gate.sheet };
}
