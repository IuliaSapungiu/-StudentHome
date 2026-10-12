import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { colors, radius } from '@/theme';
import { useSession } from '@/features/session/SessionProvider';
import { useVerification } from '@/features/verification/VerificationProvider';
import { demoControls } from './demoControls';

// DEMO ONLY: stands in for the user opening the link in the verification email.
export function DemoEmailSimulation() {
  const { user } = useSession();
  const { refresh } = useVerification();
  if (!user) return null;
  const run = async (outcome: 'verified' | 'failed') => {
    await demoControls.completeEmail(user, outcome);
    await refresh();
  };
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Demo controls</Text>
      <Text style={styles.text}>No real email is sent. Use these buttons to simulate what happens next.</Text>
      <Button label="Simulate opening the verification link" onPress={() => run('verified')} />
      <Button variant="outline" label="Simulate an expired link" onPress={() => run('failed')} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10, backgroundColor: colors.warning, borderRadius: radius.md, padding: 14 },
  title: { fontSize: 13, fontWeight: '700', color: '#6B4600' },
  text: { fontSize: 12, color: '#6B4600' },
});
