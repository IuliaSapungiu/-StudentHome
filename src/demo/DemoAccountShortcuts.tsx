import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';
import { useSession } from '@/features/session/SessionProvider';
import type { MockUser } from '@/features/session/types';
import { DEMO_ACCOUNTS } from './demoAccounts';

// DEMO ONLY. "or preview account types" on the login screen. See src/demo/README.md to remove.
export function DemoAccountShortcuts({ onSignedIn }: { onSignedIn: (user: MockUser) => void }) {
  const { signInAsMockUser } = useSession();
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or preview account types</Text>
        <View style={styles.line} />
      </View>
      {DEMO_ACCOUNTS.map((a) => (
        <Pressable
          key={a.key}
          accessibilityRole="button"
          onPress={async () => onSignedIn(await signInAsMockUser(a.user))}
          style={styles.row}>
          <Ionicons name={a.key === 'both' ? 'people-outline' : a.key === 'landlord' ? 'home-outline' : 'school-outline'} size={20} color={colors.primary} />
          <Text style={styles.label}>{a.label}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.text} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 11, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
});
