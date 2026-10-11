import { Stack } from 'expo-router';
import { demoAccountsEnabled } from '@/config/demo';
import { SessionProvider } from '@/features/session/SessionProvider';

export default function RootLayout() {
  return (
    <SessionProvider allowDemoAccounts={demoAccountsEnabled}>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  );
}
