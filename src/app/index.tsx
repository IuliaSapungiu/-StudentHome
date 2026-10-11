import { Redirect } from 'expo-router';

// Later: send landlords to /(landlord) and logged-out users to login.
export default function Index() {
  return <Redirect href="/(student)" />;
}
