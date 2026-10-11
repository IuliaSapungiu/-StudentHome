import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { useSession } from '@/features/session/SessionProvider';
import { getModeAction, homeRouteFor, initialsFor } from '@/features/session/sessionLogic';
import type { Mode } from '@/features/session/types';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string };

const STUDENT_ROWS: Row[][] = [
  [
    { icon: 'heart-outline', label: 'Saved properties' },
    { icon: 'chatbubble-outline', label: 'Messages' },
    { icon: 'calendar-outline', label: 'Viewings' },
    { icon: 'home-outline', label: 'Bookings' },
    { icon: 'notifications-outline', label: 'Notifications' },
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

// Shared by the student and landlord Profile tabs. Menu rows are display-only for now.
export function ProfileScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { user, logout, switchMode, becomeProvider } = useSession();
  if (!user) return null;

  const action = getModeAction(user, mode);
  const groups = mode === 'provider' ? PROVIDER_ROWS : STUDENT_ROWS;

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.md }}>
          <Text style={styles.title}>Profile</Text>

          <View style={styles.card}>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsFor(user)}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>{user.displayName ?? user.email}</Text>
                {user.displayName ? <Text style={styles.email} numberOfLines={1}>{user.email}</Text> : null}
                <View style={styles.roleRow}>
                  <Ionicons name="shield-outline" size={13} color={colors.primary} />
                  <Text style={styles.role}>{mode === 'provider' ? 'Landlord profile' : 'Student profile'}</Text>
                </View>
              </View>
            </View>
          </View>

          {action && <Button variant="dark" label={action.label} onPress={onModeAction} />}

          {groups.map((rows, i) => (
            <View key={i} style={styles.card}>
              {rows.map((row, j) => (
                <View key={row.label} style={[styles.menuRow, j > 0 && styles.menuDivider]}>
                  <View style={styles.menuIcon}>
                    <Ionicons name={row.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>{row.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.text} />
                </View>
              ))}
            </View>
          ))}

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
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  menuDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  menuIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  footer: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
});
