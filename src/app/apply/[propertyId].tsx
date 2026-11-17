import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ApplicationNotice } from '@/components/ApplicationNotice';
import { Checkbox } from '@/components/Checkbox';
import { ContentContainer } from '@/components/ContentContainer';
import { PropertyStrip } from '@/components/PropertyStrip';
import { TextField } from '@/components/TextField';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { Chip } from '@/components/search/Chip';
import { propertyRepository, type Property } from '@/data';
import { formatDateLong, localDate } from '@/lib/dateTime';
import { dateRange } from '@/lib/dateRange';
import { CONTACT_ORIGINS, type ContactOrigin } from '@/features/shared/attribution';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useSession } from '@/features/session/SessionProvider';
import { fullNameOf } from '@/features/session/sessionLogic';
import { useGatedSubmit } from '@/features/verification/useGatedSubmit';
import { useApplications } from '@/features/applications/ApplicationsProvider';
import { isActiveApplication, LEASE_MONTH_OPTIONS, MESSAGE_MAX_LENGTH, OCCUPANTS_RANGE, STUDY_STATUS_LABEL, validateApplication, type FieldErrors } from '@/features/applications/applicationRules';
import { STUDY_STATUSES, type StudyStatus } from '@/features/applications/types';

// A rental application is an expression of interest, not a booking. Each application is for ONE home and is
// reviewed and submitted individually; common answers are reused from your last application.
export default function ApplyScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { propertyId, origin: originParam } = useLocalSearchParams<{ propertyId: string; origin?: string }>();
  const { user } = useSession();
  const { applications, defaults, submit } = useApplications();
  const origin: ContactOrigin = (CONTACT_ORIGINS as readonly string[]).includes(originParam ?? '') ? (originParam as ContactOrigin) : 'property_detail';

  const [property, setProperty] = useState<Property | null | undefined>(undefined);
  const [moveIn, setMoveIn] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [leaseMonths, setLeaseMonths] = useState<number>(12);
  const [occupants, setOccupants] = useState(1);
  const [university, setUniversity] = useState('');
  const [studyStatus, setStudyStatus] = useState<StudyStatus | null>(null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let alive = true;
    if (propertyId) propertyRepository.getById(propertyId).then((p) => alive && setProperty(p));
    else setProperty(null);
    return () => {
      alive = false;
    };
  }, [propertyId]);

  // Reuse the common answers from the last application once, so nothing the student typed is overwritten.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !defaults) return;
    prefilled.current = true;
    setUniversity((u) => u || defaults.university);
    setStudyStatus((s) => s ?? defaults.studyStatus);
    setOccupants(defaults.occupants);
    setLeaseMonths(defaults.leaseMonths);
  }, [defaults]);

  const today = localDate(new Date());
  const open = applications.find((a) => a.propertyId === propertyId && isActiveApplication(a));

  const input = () => ({ propertyId: propertyId ?? '', preferredMoveIn: moveIn ?? '', leaseMonths, occupants, university, studyStatus, message: message || null, consent, origin });

  const submitting = useRef(false);
  const doSubmit = async () => {
    if (submitting.current) return; // never submit twice
    submitting.current = true;
    setBusy(true);
    setFormError(null);
    const r = await submit(input());
    setBusy(false);
    submitting.current = false;
    // The confirmation appears ONLY after the repository has accepted the application.
    if (r.ok) setSubmitted(true);
    else {
      setErrors(r.error.fields ?? {});
      setFormError(r.error.message);
    }
  };
  // 1) validate the whole form first (errors only, no verification prompt); 2) if valid, the existing gate runs
  // (email screen / SMS sheet when needed); 3) the application is submitted once, after verification.
  // The form stays mounted underneath, so everything the student typed is still there afterwards.
  const validate = () => {
    const checked = validateApplication(input(), today);
    if (!checked.ok) {
      setErrors(checked.fields);
      setFormError('Please check the highlighted fields.');
      return false;
    }
    setErrors({});
    setFormError(null);
    return true;
  };
  const gated = useGatedSubmit('rental_application', doSubmit, validate);
  const onPressSubmit = gated.trigger;

  if (property === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }
  if (!property) {
    return (
      <SafeAreaView style={styles.safe}>
        <ContentContainer style={{ gap: spacing.md, paddingTop: spacing.md }}>
          <BackButton />
          <Text style={styles.title}>This home isn’t available</Text>
          <Text style={styles.muted}>It may have been removed or is no longer listed.</Text>
        </ContentContainer>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView>
          <ContentContainer maxWidth={560} style={{ gap: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={34} color={colors.primary} />
            </View>
            <Text style={styles.title}>Application submitted</Text>
            <Text style={styles.muted}>Your application for {property.title} has been sent to the landlord.</Text>
            <ApplicationNotice />
            <Button label="View my applications" onPress={() => router.replace('/applications')} />
            <Button variant="outline" label="Back to the home" onPress={() => router.back()} />
          </ContentContainer>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const range = dateRange(today); // the same range as the viewing calendar: today to two years ahead, from the clock
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
          <ContentContainer maxWidth={640} style={{ gap: spacing.lg }}>
            <View style={styles.header}>
              <BackButton />
              <Text style={styles.title}>Apply to rent</Text>
            </View>
            <PropertyStrip property={property} />
            <ApplicationNotice />

            {open ? (
              <View style={styles.openBox}>
                <Text style={styles.openText}>You already have an open application for this home.</Text>
                <Button variant="outline" label="View my applications" onPress={() => router.push('/applications')} />
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.section}>Your details</Text>
              <Detail label="Full name" value={user ? fullNameOf(user) ?? '' : ''} />
              <Detail label="Email" value={user?.email ?? ''} />
              <Detail label="Phone" value={user?.phone ?? 'Verified by SMS when you submit'} />
              <Text style={styles.fine}>Taken from your account. These are shared with the landlord when you submit.</Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Preferred move-in date <Text style={styles.req}>*</Text></Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose move-in date" onPress={() => setShowCalendar((o) => !o)} style={[styles.dateBtn, errors.preferredMoveIn ? styles.dateErr : null]}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.dateText}>{moveIn ? formatDateLong(moveIn) : 'Choose a date'}</Text>
              </Pressable>
              {showCalendar ? <MonthCalendar selected={moveIn} min={range.min} max={range.max} onSelect={(d) => { setMoveIn(d); setShowCalendar(false); }} /> : null}
              {errors.preferredMoveIn ? <Text style={styles.error}>{errors.preferredMoveIn}</Text> : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Lease length <Text style={styles.req}>*</Text></Text>
              <View style={styles.chips}>
                {LEASE_MONTH_OPTIONS.map((m) => (
                  <Chip key={m} label={`${m} months`} selected={leaseMonths === m} onPress={() => setLeaseMonths(m)} />
                ))}
              </View>
              {errors.leaseMonths ? <Text style={styles.error}>{errors.leaseMonths}</Text> : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Number of occupants <Text style={styles.req}>*</Text></Text>
              <View style={styles.stepper}>
                <Pressable accessibilityRole="button" accessibilityLabel="Fewer occupants" disabled={occupants <= OCCUPANTS_RANGE.min} onPress={() => setOccupants((n) => n - 1)} style={[styles.stepBtn, occupants <= OCCUPANTS_RANGE.min && { opacity: 0.4 }]}>
                  <Ionicons name="remove" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.stepValue} accessibilityLabel={`${occupants} occupants`}>{occupants}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="More occupants" disabled={occupants >= OCCUPANTS_RANGE.max} onPress={() => setOccupants((n) => n + 1)} style={[styles.stepBtn, occupants >= OCCUPANTS_RANGE.max && { opacity: 0.4 }]}>
                  <Ionicons name="add" size={20} color={colors.text} />
                </Pressable>
              </View>
              {errors.occupants ? <Text style={styles.error}>{errors.occupants}</Text> : null}
            </View>

            <TextField label="University" marker="required" value={university} onChangeText={setUniversity} placeholder="For example: ASE Bucharest" error={errors.university} maxLength={100} />

            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Study status <Text style={styles.req}>*</Text></Text>
              <View style={styles.chips}>
                {STUDY_STATUSES.map((s) => (
                  <Chip key={s} label={STUDY_STATUS_LABEL[s]} selected={studyStatus === s} onPress={() => setStudyStatus(s)} />
                ))}
              </View>
              {errors.studyStatus ? <Text style={styles.error}>{errors.studyStatus}</Text> : null}
            </View>

            <TextField label="Message to the landlord" marker="optional" value={message} onChangeText={setMessage} multiline maxLength={MESSAGE_MAX_LENGTH} placeholder="Introduce yourself in a sentence or two." error={errors.message} style={{ minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }} />

            <View style={{ gap: spacing.sm }}>
              <Checkbox checked={consent} onChange={setConsent} error={!!errors.consent}>
                <Text style={styles.consent}>I agree to share these details with this landlord, and I understand that this is an application and not a booking or a rental.</Text>
              </Checkbox>
              {errors.consent ? <Text style={styles.error}>{errors.consent}</Text> : null}
            </View>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Button label="Submit application" onPress={onPressSubmit} loading={busy} disabled={!!open} />
            <Text style={styles.fine}>Applying needs a verified email, and a verified phone the first time.</Text>
          </ContentContainer>
        </ScrollView>
        {gated.sheet}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { fontSize: 22, color: colors.text, flexShrink: 1 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  section: { fontSize: 14, fontWeight: '700', color: colors.text },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  detailLabel: { fontSize: 13, color: colors.muted },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.text },
  fine: { fontSize: 11, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  req: { color: '#D64545' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', paddingHorizontal: 16 },
  dateErr: { borderColor: '#D64545' },
  dateText: { fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
  consent: { fontSize: 13, color: colors.text, lineHeight: 19 },
  error: { fontSize: 12, color: '#D64545' },
  openBox: { backgroundColor: colors.warning, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  openText: { fontSize: 13, color: '#8A5A00' },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
