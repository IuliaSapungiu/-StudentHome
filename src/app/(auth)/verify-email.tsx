import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { StatusPill } from '@/components/StatusPill';
import { demoVerificationEnabled } from '@/config/demo';
import { DemoEmailSimulation } from '@/demo/DemoEmailSimulation';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useSession } from '@/features/session/SessionProvider';
import { useAfterAuth } from '@/features/session/useAfterAuth';
import { useVerification } from '@/features/verification/VerificationProvider';
import { STATUS_NEXT_STEP } from '@/features/verification/verificationRules';

// Email verification (simulated). Opened right after registration, or when an action needs a verified email.
export default function VerifyEmailScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { from, reason } = useLocalSearchParams<{ from?: string; reason?: string }>();
  const { user } = useSession();
  const afterAuth = useAfterAuth();
  const v = useVerification();
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState(false);
  const fromRegister = from === 'register';

  // "Send" the email once when the screen opens and nothing has been sent yet.
  useEffect(() => {
    if (v.emailStatus === 'not_started' && v.simulated) {
      v.requestEmailVerification().then((r) => !r.ok && r.error.code !== 'cooldown' && setError(r.error.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;
  const verified = v.emailStatus === 'verified';

  const resend = async () => {
    setError(null);
    const r = await v.requestEmailVerification();
    if (r.ok) setSentNote(true);
    else setError(r.error.message);
  };

  const finish = () => {
    if (fromRegister) afterAuth(user);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <ContentContainer maxWidth={480} style={{ gap: spacing.lg }}>
          {!fromRegister && (
            <View style={{ alignSelf: 'flex-start' }}>
              <BackButton />
            </View>
          )}
          <BrandMark />
          <View style={styles.icon}>
            <Ionicons name={verified ? 'checkmark-circle-outline' : 'mail-outline'} size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>{verified ? 'Email verified' : 'Verify your email'}</Text>
          <Text style={styles.subtitle}>
            {verified
              ? 'Thanks. You can now message landlords and request viewings.'
              : `We sent a verification link to ${user.email}. Open it to confirm your address.`}
          </Text>
          {reason && !verified ? <Text style={styles.reason}>You need a verified email for this action.</Text> : null}

          <View style={{ alignItems: 'center', gap: 6 }}>
            <StatusPill status={v.emailStatus} simulated={v.simulated} />
            <Text style={styles.next}>{STATUS_NEXT_STEP[v.emailStatus]}</Text>
          </View>

          {!v.simulated && <Text style={styles.next}>Verification is not available in this build.</Text>}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {sentNote ? <Text style={styles.next}>We sent another email.</Text> : null}

          {demoVerificationEnabled && !verified && <DemoEmailSimulation />}

          <View style={{ gap: 12 }}>
            {verified ? (
              <Button label="Continue" onPress={finish} />
            ) : (
              <>
                <Button variant="outline" label="Resend email" onPress={resend} />
                <Button variant="outline" label={fromRegister ? 'Skip for now' : 'Back'} onPress={finish} />
              </>
            )}
          </View>
          <Text style={styles.footnote}>You can browse and save homes without verifying your email.</Text>
        </ContentContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  icon: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, lineHeight: 34, textAlign: 'center', color: colors.text },
  subtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: colors.muted },
  reason: { fontSize: 12, textAlign: 'center', color: '#8A5A00' },
  next: { fontSize: 12, textAlign: 'center', color: colors.muted },
  error: { fontSize: 13, textAlign: 'center', color: '#D64545' },
  footnote: { fontSize: 11, textAlign: 'center', color: colors.muted },
});
