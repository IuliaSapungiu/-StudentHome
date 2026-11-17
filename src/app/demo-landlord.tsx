import { Redirect } from 'expo-router';
import { demoLandlordEnabled } from '@/config/demo';
import { DemoLandlordControls } from '@/demo/DemoLandlordControls';
import { RequireAccount } from '@/features/session/RequireAccount';

// DEMO ONLY. Redirects away unless demo landlord responses are enabled (see src/config/demo.ts).
// This is not a landlord screen: the real landlord screens belong to Step 7.
export default function DemoLandlordRoute() {
  if (!demoLandlordEnabled) return <Redirect href="/" />;
  return (
    <RequireAccount>
      <DemoLandlordControls />
    </RequireAccount>
  );
}
