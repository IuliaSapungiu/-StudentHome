import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';

const benefits = [
  { icon: 'heart-outline', label: 'Save and compare properties' },
  { icon: 'chatbubble-outline', label: 'Keep conversations in StudentHouse' },
  { icon: 'calendar-outline', label: 'Request and manage viewings' },
] as const;

// Shown when a guest tries something that needs an account.
export default function AccountRequiredScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <ContentContainer maxWidth={480} style={{ gap: spacing.lg }}>
          <View style={{ alignSelf: 'flex-start' }}>
            <BackButton />
          </View>
          <BrandMark />
          <View style={styles.shield}>
            <Ionicons name="shield-checkmark-outline" size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>Create an account to continue</Text>
          <Text style={styles.subtitle}>
            Browsing is always open. Create a free account to save homes, message landlords and request physical viewings.
          </Text>
          <View style={styles.benefits}>
            {benefits.map((b) => (
              <View key={b.label} style={styles.benefit}>
                <Ionicons name={b.icon} size={22} color={colors.primary} />
                <Text style={styles.benefitText}>{b.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 12 }}>
            <Button label="Create free account" onPress={() => router.push('/register')} />
            <Button variant="outline" label="Log in" onPress={() => router.push('/login')} />
          </View>
          <Text style={styles.footnote}>Student accounts are completely free.</Text>
        </ContentContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  shield: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, lineHeight: 36, textAlign: 'center', color: colors.text },
  subtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: colors.muted },
  benefits: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, gap: spacing.md },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitText: { fontSize: 13, color: colors.text },
  footnote: { fontSize: 11, textAlign: 'center', color: colors.muted },
});
