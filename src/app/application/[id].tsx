import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { ApplicationNotice } from '@/components/ApplicationNotice';
import { ApplicationStatusBadge } from '@/components/ApplicationStatusBadge';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { PropertyStrip } from '@/components/PropertyStrip';
import { usePropertiesById } from '@/hooks/use-properties-by-ids';
import { formatDateLong, localDate } from '@/lib/dateTime';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useOpenConversation } from '@/features/messaging/useOpenConversation';
import { useApplications } from '@/features/applications/ApplicationsProvider';
import { isActiveApplication, STATUS_LABEL, STUDY_STATUS_LABEL } from '@/features/applications/applicationRules';

export default function ApplicationDetailScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { applications, ready, withdraw } = useApplications();
  const app = applications.find((a) => a.id === id);
  const { byId } = usePropertiesById(app ? [app.propertyId] : []);
  const messageGate = useOpenConversation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!app) {
    return (
      <SafeAreaView style={styles.safe}>
        <ContentContainer style={{ gap: spacing.md, paddingTop: spacing.md }}>
          <BackButton />
          <Text style={styles.title}>{ready ? 'This application isn’t available' : 'Loading…'}</Text>
        </ContentContainer>
      </SafeAreaView>
    );
  }
  const property = byId[app.propertyId];
  const day = (iso: string) => formatDateLong(localDate(new Date(iso)));

  const onWithdraw = async () => {
    setBusy(true);
    const r = await withdraw(app.id);
    setBusy(false);
    setConfirming(false);
    if (!r.ok) setError(r.error.message);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.lg }}>
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.title}>Application</Text>
            <ApplicationStatusBadge status={app.status} />
          </View>
          {property ? <PropertyStrip property={property} /> : <Text style={styles.muted}>This listing is no longer available.</Text>}

          {app.status === 'accepted' ? (
            <View style={styles.accepted}>
              <Text style={styles.acceptedTitle}>The landlord is interested in going ahead</Text>
              <Text style={styles.acceptedText}>Continue the conversation to talk about next steps. Acceptance does not reserve the home or hold a room, create a contract, require payment or guarantee a rental.</Text>
              <Button label="Message landlord" onPress={() => messageGate.open(app.propertyId, 'other')} />
            </View>
          ) : (
            <ApplicationNotice />
          )}

          <View style={styles.card}>
            <Text style={styles.section}>What you sent</Text>
            <Row label="Name" value={app.applicantName} />
            <Row label="Email" value={app.applicantEmail} />
            <Row label="Phone" value={app.applicantPhone} />
            <Row label="Move-in" value={formatDateLong(app.preferredMoveIn)} />
            <Row label="Lease" value={`${app.leaseMonths} months`} />
            <Row label="Occupants" value={String(app.occupants)} />
            <Row label="University" value={app.university} />
            <Row label="Study status" value={STUDY_STATUS_LABEL[app.studyStatus]} />
            {app.message ? <Text style={styles.message}>“{app.message}”</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Status history</Text>
            {app.history.map((h, i) => (
              <View key={i} style={styles.timeline}>
                <View style={styles.dot} />
                <Text style={styles.timelineText}>
                  {STATUS_LABEL[h.status]} · {day(h.at)}{h.simulated ? ' · Demo (simulated landlord)' : ''}
                </Text>
              </View>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {isActiveApplication(app) ? (
            confirming ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.muted}>Withdraw this application? The landlord will see that you withdrew it. You can apply again later.</Text>
                <Button variant="outline" label="Keep my application" onPress={() => setConfirming(false)} />
                <Button variant="dark" label="Yes, withdraw" onPress={onWithdraw} loading={busy} />
              </View>
            ) : (
              <Button variant="outline" label="Withdraw application" onPress={() => setConfirming(true)} />
            )
          ) : null}
          {app.status !== 'accepted' && app.status !== 'withdrawn' ? <Button variant="outline" label="Message landlord" onPress={() => messageGate.open(app.propertyId, 'other')} /> : null}
          <Button variant="outline" label="All applications" onPress={() => router.replace('/applications')} />
        </ContentContainer>
      </ScrollView>
      {messageGate.sheet}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { flex: 1, fontSize: 22, color: colors.text },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  section: { fontSize: 14, fontWeight: '700', color: colors.text },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.text },
  message: { fontSize: 13, color: colors.text, fontStyle: 'italic', marginTop: spacing.sm },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  timelineText: { fontSize: 13, color: colors.text },
  accepted: { backgroundColor: colors.mint, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  acceptedTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  acceptedText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  error: { fontSize: 13, color: '#D64545' },
});
