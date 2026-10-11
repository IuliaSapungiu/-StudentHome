import { Redirect } from 'expo-router';
import { useSession } from '@/features/session/SessionProvider';
import { homeRouteFor } from '@/features/session/sessionLogic';

// Guests and students open the student app; provider-mode users open the landlord app.
export default function Index() {
  const { status, user } = useSession();
  if (status === 'loading') return null;
  return <Redirect href={homeRouteFor(user?.activeMode ?? 'student')} />;
}
