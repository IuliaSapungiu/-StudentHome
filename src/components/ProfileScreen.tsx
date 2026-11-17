import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { VerificationBanner } from '@/components/VerificationBanner';
import { demoLandlordEnabled, demoVerificationEnabled } from '@/config/demo';
import { ContentContainer } from '@/components/ContentContainer';
import { useSession } from '@/features/session/SessionProvider';
import { fullNameOf, getModeAction, homeRouteFor, initialsFor } from '@/features/session/sessionLogic';
import { useApplications } from '@/features/applications/ApplicationsProvider';
import { useMessaging } from '@/features/messaging/MessagingProvider';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { useSaved } from '@/features/saved/SavedProvider';
import { useVerification } from '@/features/verification/VerificationProvider';
import { useViewings } from '@/features/viewings/ViewingsProvider';
import type { Mode } from '@/features/session/types';

// `href` makes a row work; rows without one are display-only (Bookings stays inactive on purpose).
type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; href?: Href; detail?: string };

type Counts = { saved: number; unread: number; upcoming: number; applications: number; notifications: number };

const studentRows = (c: Counts): Row[][] => [
  [
    { icon: 'heart-outline', label: 'Saved properties', href: '/(student)/saved', detail: c.saved > 0 ? String(c.saved) : undefined },
    { icon: 'chatbubble-outline', label: 'Messages', href: '/(student)/messages', detail: c.unread > 0 ? `${c.unread} unread` : undefined },
    { icon: 'calendar-outline', label: 'Viewings', href: '/my-viewings', detail: c.upcoming > 0 ? `${c.upcoming} upcoming` : undefined },
    { icon: 'document-text-outline', label: 'Applications', href: '/applications', detail: c.applications > 0 ? `${c.applications} active` : undefined },
    { icon: 'home-outline', label: 'Bookings' },
    { icon: 'notifications-outline', label: 'Notifications', href: '/notifications', detail: c.notifications > 0 ? `${c.notifications} unread` : undefined },
  ],
  [
    { icon: 'people-outline', label: 'Help & support' },
    { icon: 'settings-outline', label: 'Settings' },
  ],
];

const PROVIDER_ROWS: Row[][] = [
  [
    { icon: 'home-outline', label: 'Business details' },
    { icon: 'notifications-outline', label: 'Notifications' },
    { icon: 'settings-outline', label: 'Payouts & billing' },
    { icon: 'shield-checkmark-outline', label: 'Verification' },
  ],
  [
    { icon: 'people-outline', label: 'Help & support' },
    { icon: 'settings-outline', label: 'Settings' },
  ],
];

// Shared by the student and landlord Profile tabs. On the student side Saved, Messages, Viewings and Applications
// open their screens; the other rows are display-only for now.
export function ProfileScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { user, logout, switchMode, becomeProvider } = useSession();
  const verification = useVerification();
  const saved = useSaved();
  const { unreadCount } = useMessaging();
  const { upcomingCount } = useViewings();
  const { activeCount } = useApplications();
  const { unreadCount: notificationCount } = useNotifications();
  if (!user) return null;

  const action = getModeAction(user, mode);
  const groups: Row[][] = mode === 'provider' ? PROVIDER_ROWS : studentRows({ saved: saved.count, unread: unreadCount, upcoming: upcomingCount, applications: activeCount, notifications: notificationCount });

  const onModeAction = async () => {
    if (!action) return;
    if (action.kind === 'become_provider') {
      await becomeProvider();
      router.replace(homeRouteFor('provider'));
    } else {
      await switchMode(action.to);
      router.replace(homeRouteFor(action.to));
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.md }}>
          <Text style={styles.title}>Profile</Text>

          <View style={styles.card}>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsFor(user)}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>{fullNameOf(user) ?? user.email}</Text>
                {fullNameOf(user) ? <Text style={styles.email} numberOfLines={1}>{user.email}</Text> : null}
                {user.phone ? <Text style={styles.email} numberOfLines={1}>{user.phone}</Text> : null}
                <View style={styles.roleRow}>
                  <Ionicons name="shield-outline" size={13} color={colors.primary} />
                  <Text style={styles.role}>{mode === 'provider' ? 'Landlord profile' : 'Student profile'}</Text>
                </View>
              </View>
            </View>
          </View>

          {verification.emailStatus !== 'verified' && verification.simulated && <VerificationBanner />}

          <View style={styles.card}>
            <View style={styles.verifyRow}>
              <Text style={styles.menuLabel}>Email</Text>
              <StatusPill status={verification.emailStatus} simulated={verification.simulated} />
            </View>
            <View style={[styles.verifyRow, styles.menuDivider]}>
              <Text style={styles.menuLabel}>Phone</Text>
              <StatusPill status={verification.phoneStatus} simulated={verification.simulated} />
            </View>
            <Text style={styles.verifyNote}>We verify your phone by SMS only when you first request a viewing or send a rental application.</Text>
          </View>

          {action && <Button variant="dark" label={action.label} onPress={onModeAction} />}

          {groups.map((rows, i) => (
            <View key={i} style={styles.card}>
              {rows.map((row, j) => (
                <Pressable
                  key={row.label}
                  accessibilityRole={row.href ? 'button' : undefined}
                  accessibilityLabel={row.detail ? `${row.label}, ${row.detail}` : row.label}
                  disabled={!row.href}
                  onPress={() => row.href && router.push(row.href)}
                  style={[styles.menuRow, j > 0 && styles.menuDivider]}>
                  <View style={styles.menuIcon}>
                    <Ionicons name={row.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>{row.label}</Text>
                  {row.detail ? <Text style={styles.menuDetail}>{row.detail}</Text> : null}
                  <Ionicons name="chevron-forward" size={18} color={colors.text} />
                </Pressable>
              ))}
            </View>
          ))}

          {demoVerificationEnabled && <Button variant="outline" label="Demo controls (simulated verification)" onPress={() => router.push('/demo-controls')} />}
          {demoLandlordEnabled && mode === 'student' && <Button variant="outline" label="Demo landlord (simulated replies)" onPress={() => router.push('/demo-landlord')} />}
          <Button variant="outline" label="Log out" onPress={onLogout} />
          <Text style={styles.footer}>StudentHouse · Prototype</Text>
        </ContentContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 28, color: colors.text, marginTop: spacing.sm },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  email: { fontSize: 12, color: colors.muted },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  role: { fontSize: 12, color: colors.primary },
  verifyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  verifyNote: { fontSize: 11, color: colors.muted, paddingBottom: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  menuDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  menuIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  menuDetail: { fontSize: 12, color: '#2B6CB0' },
  footer: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
});
