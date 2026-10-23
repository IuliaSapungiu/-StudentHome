import type { ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { useSession } from '@/features/session/SessionProvider';

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue | null; size: number }) => (
    <Ionicons
      name={name}
      size={size}
      color={typeof color === 'number' ? String(color) : color ?? undefined}
    />
  );
// Bottom tabs of the student app: Home, Search, Saved, Messages, Profile.
// Home and Search are open to guests. Saved, Messages and Profile need an account.
export default function StudentTabs() {
  const { isSignedIn } = useSession();
  const router = useRouter();

  const requireAccount = {
    tabPress: (e: { preventDefault: () => void }) => {
      if (!isSignedIn) {
        e.preventDefault();
        router.push('/account-required');
      }
    },
  };

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search-outline') }} />
      <Tabs.Screen name="saved" listeners={requireAccount} options={{ title: 'Saved', tabBarIcon: icon('heart-outline') }} />
      <Tabs.Screen name="messages" listeners={requireAccount} options={{ title: 'Messages', tabBarIcon: icon('chatbubble-outline') }} />
      <Tabs.Screen name="profile" listeners={requireAccount} options={{ title: 'Profile', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
