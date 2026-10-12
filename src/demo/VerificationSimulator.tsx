import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { StatusPill } from '@/components/StatusPill';
import { TextField } from '@/components/TextField';
import { services } from '@/services';
import { useSession } from '@/features/session/SessionProvider';
import { useVerification } from '@/features/verification/VerificationProvider';
import { useVerifiedActionGate } from '@/features/verification/useVerifiedActionGate';
import { VERIFICATION_STATUSES, type VerificationKind } from '@/features/verification/types';
import { STATUS_LABEL } from '@/features/verification/verificationRules';
import { DEMO_OTP_CODE, DEMO_OTP_SERVICE_ERROR_CODE } from '@/features/verification/mockVerificationService';
import { demoControls } from './demoControls';

const DEMO_PROPERTY_ID = 'demo-1';
const ROWS: { kind: VerificationKind; label: string; subjectId?: string }[] = [
  { kind: 'email', label: 'Email' },
  { kind: 'phone', label: 'Phone (SMS)' },
  { kind: 'identity', label: 'Identity (landlord)' },
  { kind: 'company', label: 'Company' },
  { kind: 'representative_authority', label: 'Representative authority' },
  { kind: 'property', label: `Property right to let (${DEMO_PROPERTY_ID})`, subjectId: DEMO_PROPERTY_ID },
];

// DEMO ONLY. Every result here is simulated. Nothing is sent, checked or approved for real.
export function VerificationSimulator() {
  const { user, updatePhone } = useSession();
  const v = useVerification();
  const [sms, setSms] = useState<'ok' | 'fail'>(services.verificationOutcomes.smsDelivery);
  const [newPhone, setNewPhone] = useState('');
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);

  const message = useVerifiedActionGate('message');
  const viewing = useVerifiedActionGate('request_viewing');
  const application = useVerifiedActionGate('rental_application');

  if (!user) return null;

  const setStatus = async (kind: VerificationKind, status: (typeof VERIFICATION_STATUSES)[number], subjectId?: string) => {
    const value = kind === 'email' ? user.email : kind === 'phone' ? user.phone : null;
    await demoControls.setStatus(user.id, kind, status, { subjectId: subjectId ?? null, value });
    await v.refresh();
  };

  const toggleSms = () => {
    const next = sms === 'ok' ? 'fail' : 'ok';
    services.verificationOutcomes.smsDelivery = next;
    setSms(next);
  };

  const tryAction = (label: string) => () => Alert.alert('Allowed (simulated)', `${label} would go ahead now.`);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
          <ContentContainer maxWidth={640} style={{ gap: spacing.lg }}>
            <View style={styles.header}>
              <BackButton />
              <Text style={styles.title}>Demo controls</Text>
            </View>
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                DEMO ONLY. Everything here is simulated and is not real verification. No emails or text messages are sent, and no documents are checked.
              </Text>
            </View>

            <Text style={styles.section}>Verification statuses for {user.email}</Text>
            {ROWS.map((r) => (
              <View key={r.kind} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.label}>{r.label}</Text>
                  <StatusPill status={v.statusFor(r.kind, r.subjectId ?? null)} simulated />
                </View>
                <View style={styles.chips}>
                  {VERIFICATION_STATUSES.map((s) => (
                    <Text key={s} onPress={() => setStatus(r.kind, s, r.subjectId)} style={styles.chip} accessibilityRole="button">
                      {STATUS_LABEL[s]}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
            <Text style={styles.note}>
              Identity, company, authority and property are separate checks: setting one never changes another. Email and phone only count for the current address and number.
            </Text>

            <Text style={styles.section}>SMS</Text>
            <View style={styles.card}>
              <Text style={styles.note}>Codes: {DEMO_OTP_CODE} succeeds. {DEMO_OTP_SERVICE_ERROR_CODE} simulates a service error. Anything else is a wrong code (5 wrong codes lock for 15 minutes; resend waits 30 seconds).</Text>
              <Button variant="outline" label={`SMS delivery: ${sms === 'ok' ? 'works' : 'fails'} (tap to change)`} onPress={toggleSms} />
            </View>

            <Text style={styles.section}>Change my phone number</Text>
            <View style={styles.card}>
              <Text style={styles.note}>Current number: {user.phone ?? 'none'}. A new number must be verified again.</Text>
              <TextField label="New phone number" marker="optional" keyboardType="phone-pad" placeholder="07xx xxx xxx or +44 …" value={newPhone} onChangeText={setNewPhone} error={phoneMsg} />
              <Button
                variant="outline"
                label="Save new number"
                onPress={async () => {
                  const r = await updatePhone(newPhone);
                  setPhoneMsg(r.ok ? null : r.error);
                  if (r.ok) { setNewPhone(''); await v.refresh(); }
                }}
              />
            </View>

            <Text style={styles.section}>Try the access rules</Text>
            <View style={styles.card}>
              <Text style={styles.note}>Messaging, viewings and applications arrive in a later step, so these buttons test the rules directly.</Text>
              <Button variant="outline" label="Try: message a landlord" onPress={() => message.run(tryAction('Sending the message'))} />
              <Button variant="outline" label="Try: first viewing request" onPress={() => viewing.run(tryAction('The viewing request'))} />
              <Button variant="outline" label="Try: rental application" onPress={() => application.run(tryAction('The rental application'))} />
            </View>

            <Button
              variant="dark"
              label="Reset all my verification"
              onPress={async () => {
                await demoControls.reset(user.id);
                await v.refresh();
              }}
            />
          </ContentContainer>
        </ScrollView>
      </KeyboardAvoidingView>
      {message.sheet}
      {viewing.sheet}
      {application.sheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 22, color: colors.text },
  banner: { backgroundColor: colors.warning, borderRadius: radius.md, padding: 12 },
  bannerText: { fontSize: 12, lineHeight: 17, color: '#6B4600', fontWeight: '600' },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 11, color: colors.primaryDark, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden' },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
