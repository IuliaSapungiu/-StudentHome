import { View, type ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { useSession } from '@/features/session/SessionProvider';
import { useMessaging } from '@/features/messaging/MessagingProvider';
import { useNotifications } from '@/features/notifications/NotificationsProvider';

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue | null; size: number }) => (
    <Ionicons
      name={name}
      size={size}
      color={typeof color === 'number' ? String(color) : color ?? undefined}
    />
  );
// Tab icon with a small dot while there is something unread (messages; notifications on Profile).
const dotIcon = (name: 'chatbubble-outline' | 'person-outline', unread: number) =>
  ({ color, size }: { color: ColorValue | null; size: number }) => (
    <View>
      <Ionicons name={name} size={size} color={typeof color === 'number' ? String(color) : color ?? undefined} />
      {unread > 0 && <View style={{ position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: '#D64545' }} />}
    </View>
  );

// Bottom tabs of the student app: Home, Search, Saved, Messages, Profile.
// Home and Search are open to guests. Saved, Messages and Profile need an account.
export default function StudentTabs() {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { unreadCount } = useMessaging();
  const { unreadCount: notificationCount } = useNotifications();

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
      <Tabs.Screen name="messages" listeners={requireAccount} options={{ title: 'Messages', tabBarIcon: dotIcon('chatbubble-outline', unreadCount), tabBarAccessibilityLabel: unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages' }} />
      <Tabs.Screen name="profile" listeners={requireAccount} options={{ title: 'Profile', tabBarIcon: dotIcon('person-outline', notificationCount), tabBarAccessibilityLabel: notificationCount > 0 ? `Profile, ${notificationCount} unread notifications` : 'Profile' }} />
    </Tabs>
  );
}
