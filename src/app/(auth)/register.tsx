import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { OptionCard } from '@/components/OptionCard';
import { TextField } from '@/components/TextField';
import { useSession } from '@/features/session/SessionProvider';
import { useAfterAuth } from '@/features/session/useAfterAuth';
import { validateEmail, validateNewPassword } from '@/features/session/validation';
import type { RegistrationIntent } from '@/features/session/types';

const OPTIONS: { intent: RegistrationIntent; icon: 'school-outline' | 'home-outline' | 'people-outline'; title: string; subtitle: string }[] = [
  { intent: 'student', icon: 'school-outline', title: "I'm looking for a home", subtitle: 'Create a free student profile' },
  { intent: 'provider', icon: 'home-outline', title: 'I want to list a property', subtitle: 'Landlord profile creation is free' },
  { intent: 'both', icon: 'people-outline', title: 'Both', subtitle: 'Student + Landlord profiles' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useSession();
  const afterAuth = useAfterAuth();
  const [intent, setIntent] = useState<RegistrationIntent>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = { email: validateEmail(email), password: validateNewPassword(password) };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    const result = await register({ email, intent }); // the password is validated here and never stored
    setBusy(false);
    if (!result.ok) return setErrors({ form: result.error });
    setPassword('');
    afterAuth(result.user);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
          <ContentContainer maxWidth={480} style={{ gap: spacing.lg }}>
            <View style={styles.header}>
              <BackButton />
              <Text style={styles.headerTitle}>Create account</Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.title}>How will you use StudentHouse?</Text>
              <Text style={styles.subtitle}>One account can include both a student and landlord profile.</Text>
            </View>

            <View style={{ gap: 12 }} accessibilityRole="radiogroup">
              {OPTIONS.map((o) => (
                <OptionCard key={o.intent} icon={o.icon} title={o.title} subtitle={o.subtitle} selected={intent === o.intent} onPress={() => setIntent(o.intent)} />
              ))}
            </View>

            <TextField
              label="Email address"
              placeholder="you@email.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextField
              label="Create password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />

            {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
            <Button label="Continue" onPress={submit} loading={busy} />

            <Text style={styles.switch}>
              Already have an account?{' '}
              <Text style={styles.link} onPress={() => router.replace('/login')}>
                Log in
              </Text>
            </Text>
          </ContentContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTitle: { fontSize: 22, color: colors.text },
  title: { fontSize: 30, lineHeight: 36, color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  formError: { fontSize: 13, color: '#D64545' },
  switch: { fontSize: 13, textAlign: 'center', color: colors.muted },
});
