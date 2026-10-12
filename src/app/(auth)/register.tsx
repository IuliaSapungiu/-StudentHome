import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { ContentContainer } from '@/components/ContentContainer';
import { FieldRenderer } from '@/components/FieldRenderer';
import { OptionCard } from '@/components/OptionCard';
import { cleanAnswers, isFieldRequired, validateForm } from '@/features/forms/formRules';
import { useRegistrationForm } from '@/features/forms/useFormConfig';
import type { Answers } from '@/features/forms/types';
import { useSession } from '@/features/session/SessionProvider';
import type { RegistrationIntent } from '@/features/session/types';

const OPTIONS: { intent: RegistrationIntent; icon: 'school-outline' | 'home-outline' | 'people-outline'; title: string; subtitle: string }[] = [
  { intent: 'student', icon: 'school-outline', title: "I'm looking for a home", subtitle: 'Create a free student profile' },
  { intent: 'provider', icon: 'home-outline', title: 'I want to list a property', subtitle: 'Landlord profile creation is free' },
  { intent: 'both', icon: 'people-outline', title: 'Both', subtitle: 'Student + Landlord profiles' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useSession();
  const form = useRegistrationForm();
  const [intent, setIntent] = useState<RegistrationIntent>('student');
  const [values, setValues] = useState<Answers>({ acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!form) return null;

  const set = (key: string) => (v: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => rest);
  };

  const submit = async () => {
    const found = validateForm(form, values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    const clean = cleanAnswers(form, values);
    setBusy(true);
    // The password is validated here and never stored or sent to the session layer.
    const result = await register({
      email: String(clean.email),
      intent,
      fullName: String(clean.fullName),
      phone: String(clean.phone),
      termsAccepted: clean.acceptTerms === true,
    });
    setBusy(false);
    if (!result.ok) return setFormError(result.error);
    setValues((prev) => ({ ...prev, password: '' }));
    router.replace({ pathname: '/verify-email', params: { from: 'register' } });
  };

  const fields = Object.fromEntries(form.fields.map((f) => [f.key, f]));
  const render = (key: string) => (
    <FieldRenderer key={key} field={fields[key]} value={values[key]} required={isFieldRequired(fields[key], values)} error={errors[key]} onChange={set(key)} />
  );

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

            <Text style={styles.legend}>Fields marked * are required.</Text>
            {render('fullName')}
            {render('email')}
            {render('phone')}
            {render('password')}

            <View style={{ gap: 6 }}>
              <Checkbox checked={values.acceptTerms === true} onChange={set('acceptTerms')} error={!!errors.acceptTerms}>
                <Text style={styles.terms}>
                  I accept the{' '}
                  <Text style={styles.link} onPress={() => router.push('/terms')}>Terms and Conditions</Text>
                  {' '}and the{' '}
                  <Text style={styles.link} onPress={() => router.push('/privacy')}>Privacy Policy</Text>
                  <Text style={{ color: '#D64545' }}> *</Text>
                </Text>
              </Checkbox>
              {errors.acceptTerms ? <Text style={styles.error}>{errors.acceptTerms}</Text> : null}
            </View>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
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
  legend: { fontSize: 12, color: colors.muted },
  terms: { fontSize: 13, lineHeight: 19, color: colors.text },
  link: { fontWeight: '700', color: colors.primary },
  error: { fontSize: 13, color: '#D64545' },
  switch: { fontSize: 13, textAlign: 'center', color: colors.muted },
});
