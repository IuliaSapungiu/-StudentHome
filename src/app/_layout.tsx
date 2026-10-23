import { Stack } from 'expo-router';
import { demoAccountsEnabled } from '@/config/demo';
import { SavedProvider } from '@/features/saved/SavedProvider';
import { SearchProvider } from '@/features/search/SearchProvider';
import { SessionProvider } from '@/features/session/SessionProvider';
import { VerificationProvider } from '@/features/verification/VerificationProvider';

export default function RootLayout() {
  return (
    <SessionProvider allowDemoAccounts={demoAccountsEnabled}>
      <VerificationProvider>
        <SearchProvider>
          <SavedProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SavedProvider>
        </SearchProvider>
      </VerificationProvider>
    </SessionProvider>
  );
}
