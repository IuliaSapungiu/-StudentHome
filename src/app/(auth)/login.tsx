import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { TextField } from '@/components/TextField';
import { demoAccountsEnabled } from '@/config/demo';
import { DemoAccountShortcuts } from '@/demo/DemoAccountShortcuts';
import { useSession } from '@/features/session/SessionProvider';
import { useAfterAuth } from '@/features/session/useAfterAuth';
import { validateEmail, validateLoginPassword } from '@/features/session/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useSession();
  const afterAuth = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = { email: validateEmail(email), password: validateLoginPassword(password) };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    const result = await login(email); // the password is only checked for presence, never stored or verified
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
              <Text style={styles.headerTitle}>Log in</Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Continue your StudentHouse journey.</Text>
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
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
            />
            <Pressable
              style={{ alignSelf: 'flex-end' }}
              onPress={() => Alert.alert('Password reset', 'Password reset is not available in this prototype yet.')}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>

            {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
            <Button label="Log in" onPress={submit} loading={busy} />

            {demoAccountsEnabled && (
              <DemoAccountShortcuts onSignedIn={afterAuth} />
            )}

            <Text style={styles.switch}>
              New to StudentHouse?{' '}
              <Text style={styles.link} onPress={() => router.replace('/register')}>
                Create account
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
  title: { fontSize: 32, color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted },
  link: { fontSize: 12, fontWeight: '700', color: colors.primary },
  formError: { fontSize: 13, color: '#D64545' },
  switch: { fontSize: 13, textAlign: 'center', color: colors.muted },
});
