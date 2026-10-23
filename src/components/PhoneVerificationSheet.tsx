import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useSession } from '@/features/session/SessionProvider';
import { useVerification } from '@/features/verification/VerificationProvider';

type Props = { visible: boolean; onClose: () => void; onVerified: () => void };

// SMS verification, shown only when a viewing request or rental application needs it (first time).
// Format checks happen elsewhere; this step is what proves the user can receive texts on the number.
export function PhoneVerificationSheet({ visible, onClose, onVerified }: Props) {
  const { user, updatePhone } = useSession();
  const v = useVerification();
  const [step, setStep] = useState<'intro' | 'code'>('intro');
  const [phoneInput, setPhoneInput] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (visible) {
      setStep('intro'); setCode(''); setError(null); setHint(null); setBusy(false); setRetryAt(null); setPhoneInput('');
      setNow(Date.now());
    }
  }, [visible]);

  useEffect(() => {
    if (!retryAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [retryAt]);

  useEffect(() => {
    if (visible && v.phoneStatus === 'verified') onVerified(); // verified in the meantime: no second SMS
  }, [visible, v.phoneStatus, onVerified]);

  if (!user) return null;
  const waitSeconds = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;

  const send = async () => {
    setBusy(true);
    setError(null);
    let target = user;
    if (!user.phone) {
      const r = await updatePhone(phoneInput);
      if (!r.ok) { setError(r.error); setBusy(false); return; }
      target = r.user;
    }
    const res = await v.startPhoneVerification(target);
    setBusy(false);
    const currentTime = Date.now();
    setNow(currentTime);
    if (res.ok) {
      setStep('code');
      setHint(res.value.demoHint ?? null);
      setRetryAt(currentTime + 30000);
    } else {
      setError(res.error.message);
      if (res.error.retryAfterMs) setRetryAt(currentTime + res.error.retryAfterMs);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const res = await v.confirmPhoneCode(code);
    setBusy(false);
    if (res.ok) onVerified();
    else setError(res.error.message);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheet} contentContainerStyle={{ gap: spacing.md, padding: spacing.lg }}>
            <Text style={styles.title}>Verify your phone number</Text>
            <Text style={styles.body}>
              We check your number once, the first time you request a viewing or send a rental application. After that you won't be asked again.
            </Text>

            {step === 'intro' && (
              <>
                {user.phone ? (
                  <Text style={styles.phone}>We will text a code to {user.phone}.</Text>
                ) : (
                  <TextField label="Phone number" marker="required" placeholder="07xx xxx xxx or +44 …" keyboardType="phone-pad" value={phoneInput} onChangeText={setPhoneInput} />
                )}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label={user.phone ? 'Send code' : 'Save number and send code'} onPress={send} loading={busy} disabled={waitSeconds > 0} />
                {waitSeconds > 0 ? <Text style={styles.small}>You can ask for another code in {waitSeconds}s.</Text> : null}
              </>
            )}

            {step === 'code' && (
              <>
                {hint ? <Text style={styles.demo}>{hint}</Text> : null}
                <TextField label="6-digit code" marker="required" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} placeholder="123456" />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label="Verify" onPress={confirm} loading={busy} disabled={code.trim().length < 6} />
                <Button variant="outline" label={waitSeconds > 0 ? `Send a new code (${waitSeconds}s)` : 'Send a new code'} onPress={send} disabled={waitSeconds > 0 || busy} />
              </>
            )}
            <Button variant="outline" label="Not now" onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: '#fff', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, flexGrow: 0 },
  title: { fontSize: 22, color: colors.text },
  body: { fontSize: 13, lineHeight: 19, color: colors.muted },
  phone: { fontSize: 15, fontWeight: '600', color: colors.text },
  demo: { fontSize: 12, backgroundColor: colors.warning, color: '#6B4600', padding: 10, borderRadius: radius.md },
  error: { fontSize: 13, color: '#D64545' },
  small: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
