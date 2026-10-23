import type { ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
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
// Landlord / provider mode: Dashboard, Listings, Messages, Viewings, Profile.
export default function LandlordTabs() {
  const { status, user } = useSession();
  if (status === 'loading') return null;
  // Guests and student-only accounts cannot enter provider mode.
  if (!user?.profiles.provider) return <Redirect href="/(student)" />;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="listings" options={{ title: 'Listings', tabBarIcon: icon('list-outline') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chatbubble-outline') }} />
      <Tabs.Screen name="viewings" options={{ title: 'Viewings', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
