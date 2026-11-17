import { Stack } from 'expo-router';
import { demoAccountsEnabled } from '@/config/demo';
import { ApplicationsProvider } from '@/features/applications/ApplicationsProvider';
import { MessagingProvider } from '@/features/messaging/MessagingProvider';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { SavedProvider } from '@/features/saved/SavedProvider';
import { SearchProvider } from '@/features/search/SearchProvider';
import { SessionProvider } from '@/features/session/SessionProvider';
import { VerificationProvider } from '@/features/verification/VerificationProvider';
import { ViewingsProvider } from '@/features/viewings/ViewingsProvider';

export default function RootLayout() {
  return (
    <SessionProvider allowDemoAccounts={demoAccountsEnabled}>
      <VerificationProvider>
        <SearchProvider>
          <SavedProvider>
            <MessagingProvider>
              <ViewingsProvider>
                <ApplicationsProvider>
                  <NotificationsProvider>
                    <Stack screenOptions={{ headerShown: false }} />
                  </NotificationsProvider>
                </ApplicationsProvider>
              </ViewingsProvider>
            </MessagingProvider>
          </SavedProvider>
        </SearchProvider>
      </VerificationProvider>
    </SessionProvider>
  );
}
