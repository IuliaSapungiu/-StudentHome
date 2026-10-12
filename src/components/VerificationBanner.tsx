import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

// Prompt shown when the email still needs verifying (messaging and viewing requests need it).
export function VerificationBanner() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/verify-email')} style={styles.box}>
      <Ionicons name="mail-unread-outline" size={20} color="#8A5A00" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.text}>Needed before you message landlords or request a viewing.</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8A5A00" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.warning, borderRadius: radius.md, padding: 14 },
  title: { fontSize: 13, fontWeight: '700', color: '#6B4600' },
  text: { fontSize: 12, color: '#6B4600' },
});
