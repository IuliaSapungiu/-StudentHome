import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { PropertyStrip } from '@/components/PropertyStrip';
import { TextField } from '@/components/TextField';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { TimeWheelPicker } from '@/components/calendar/TimeWheelPicker';
import { propertyRepository, type Property } from '@/data';
import { formatDateLong, formatDateTimeLong, toLocalDateTime } from '@/lib/dateTime';
import { CONTACT_ORIGINS, type ContactOrigin } from '@/features/shared/attribution';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useGatedSubmit } from '@/features/verification/useGatedSubmit';
import { useViewings } from '@/features/viewings/ViewingsProvider';
import { bookableRange, defaultTimeFor, isDateSelectable, NOTE_MAX_LENGTH, PREFERRED_TIME_NOTICE, toLocal, validateViewingTime, viewingHref } from '@/features/viewings/viewingRules';

// FORMAL viewing request (or a reschedule when ?rescheduleId= is given). Messaging the landlord to arrange a
// viewing does not need this. The student picks an exact date and time as a PREFERENCE; the landlord confirms it
// or suggests another time. The verification gate runs when the student presses Send, after the form is valid.
export default function RequestViewingScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { propertyId, rescheduleId, origin: originParam } = useLocalSearchParams<{ propertyId?: string; rescheduleId?: string; origin?: string }>();
  const { viewings, ready, requestViewing, reschedule } = useViewings();
  const existing = rescheduleId ? viewings.find((v) => v.id === rescheduleId) : undefined;
  const targetPropertyId = existing?.propertyId ?? propertyId ?? null;
  const origin: ContactOrigin = (CONTACT_ORIGINS as readonly string[]).includes(originParam ?? '') ? (originParam as ContactOrigin) : 'property_detail';

  const [property, setProperty] = useState<Property | null | undefined>(undefined);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<{ hour: number; minute: number }>({ hour: 12, minute: 0 });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; start: string } | null>(null);
  const submitting = useRef(false);

  const waitingForViewing = !!rescheduleId && !existing && !ready;
  useEffect(() => {
    let alive = true;
    if (waitingForViewing) return;
    if (targetPropertyId) propertyRepository.getById(targetPropertyId).then((p) => alive && setProperty(p));
    else setProperty(null);
    return () => {
      alive = false;
    };
  }, [targetPropertyId, waitingForViewing]);

  const nowLocal = toLocalDateTime(new Date());
  const range = useMemo(() => bookableRange(nowLocal), [nowLocal]);
  const start = date ? toLocal(date, time.hour, time.minute) : null;

  const chooseDate = (d: string) => {
    setDate(d);
    setError(null);
    const t = defaultTimeFor(d, toLocalDateTime(new Date()));
    if (t) setTime(t);
  };

  // Checked BEFORE any verification prompt: an incomplete or invalid request never opens email or SMS verification.
  const validate = () => {
    if (!start) {
      setError('Choose a day and a time first.');
      return false;
    }
    const check = validateViewingTime(start, toLocalDateTime(new Date()));
    if (!check.ok) {
      setError(check.message);
      return false;
    }
    setError(null);
    return true;
  };

  const submit = async () => {
    if (!start || !targetPropertyId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const r = existing ? await reschedule(existing.id, start) : await requestViewing(targetPropertyId, start, note, origin);
    setBusy(false);
    submitting.current = false;
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    if (existing) router.replace(viewingHref(r.value.id)); // straight to the exact viewing that changed
    else setSent({ id: r.value.id, start });
  };
  const gated = useGatedSubmit('request_viewing', submit, validate);

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

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <ContentContainer maxWidth={560} style={{ gap: spacing.lg, paddingTop: spacing.xl }}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>Viewing requested</Text>
          <Text style={styles.muted}>
            You asked to see {property.title} on {formatDateTimeLong(sent.start)}. This is a request: it is pending until the landlord confirms it or suggests another time. The exact address is shared once it is confirmed.
          </Text>
          <Button label="View this request" onPress={() => router.replace(viewingHref(sent.id))} />
          <Button variant="outline" label="Back to the home" onPress={() => router.back()} />
        </ContentContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
          <ContentContainer maxWidth={640} style={{ gap: spacing.lg }}>
            <View style={styles.header}>
              <BackButton />
              <Text style={styles.title}>{existing ? 'Reschedule viewing' : 'Request a viewing'}</Text>
            </View>
            <PropertyStrip property={property} />

            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={18} color="#8A5A00" />
              <Text style={styles.noticeText}>{PREFERRED_TIME_NOTICE}</Text>
            </View>

            <Text style={styles.section}>1. Choose a day</Text>
            <MonthCalendar selected={date} min={range.min} max={range.max} isDisabled={(d) => !isDateSelectable(d, nowLocal)} onSelect={chooseDate} />

            {date ? (
              <>
                <Text style={styles.section}>2. Choose the time · {formatDateLong(date)}</Text>
                <TimeWheelPicker date={date} hour={time.hour} minute={time.minute} nowLocal={nowLocal} onChange={(hour, minute) => { setTime({ hour, minute }); setError(null); }} />
              </>
            ) : null}

            {!existing ? (
              <TextField label="Note for the landlord" marker="optional" value={note} onChangeText={setNote} multiline maxLength={NOTE_MAX_LENGTH} placeholder="For example: I’d bring a friend." style={{ minHeight: 84, paddingTop: 14, textAlignVertical: 'top' }} />
            ) : null}

            {start ? <Text style={styles.summary}>You are asking for {formatDateTimeLong(start)}.</Text> : null}
            {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
            <Button label={existing ? 'Send new time' : 'Send request'} onPress={gated.trigger} loading={busy} disabled={!date} />
            <Text style={styles.fine}>Sending a request needs a verified email, and a verified phone the first time. You can also simply message the landlord to arrange a viewing.</Text>
          </ContentContainer>
        </ScrollView>
        {gated.sheet}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { fontSize: 22, color: colors.text, flexShrink: 1 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  section: { fontSize: 14, fontWeight: '700', color: colors.text },
  notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warning, borderRadius: radius.md, padding: spacing.md },
  noticeText: { flex: 1, fontSize: 12, color: '#8A5A00', lineHeight: 17 },
  summary: { fontSize: 14, fontWeight: '600', color: colors.primary },
  error: { fontSize: 13, color: '#D64545' },
  fine: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
