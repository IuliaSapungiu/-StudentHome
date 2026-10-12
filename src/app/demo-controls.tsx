import { Redirect } from 'expo-router';
import { demoVerificationEnabled } from '@/config/demo';
import { VerificationSimulator } from '@/demo/VerificationSimulator';
import { RequireAccount } from '@/features/session/RequireAccount';

// DEMO ONLY. Redirects away unless demo verification is enabled (see src/config/demo.ts).
export default function DemoControlsRoute() {
  if (!demoVerificationEnabled) return <Redirect href="/" />;
  return (
    <RequireAccount>
      <VerificationSimulator />
    </RequireAccount>
  );
}
