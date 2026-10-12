import { Stack } from 'expo-router';
import { demoAccountsEnabled } from '@/config/demo';
import { SessionProvider } from '@/features/session/SessionProvider';
import { VerificationProvider } from '@/features/verification/VerificationProvider';

export default function RootLayout() {
  return (
    <SessionProvider allowDemoAccounts={demoAccountsEnabled}>
      <VerificationProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </VerificationProvider>
    </SessionProvider>
  );
}
