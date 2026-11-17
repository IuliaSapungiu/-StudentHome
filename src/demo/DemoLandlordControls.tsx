import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ContentContainer } from '@/components/ContentContainer';
import { usePropertiesById } from '@/hooks/use-properties-by-ids';
import { describeStart, effectiveStart, statusLabel } from '@/features/viewings/viewingRules';
import { STATUS_LABEL } from '@/features/applications/applicationRules';
import { toLocalDateTime } from '@/lib/dateTime';
import { useApplications } from '@/features/applications/ApplicationsProvider';
import { useMessaging } from '@/features/messaging/MessagingProvider';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { useSession } from '@/features/session/SessionProvider';
import { useViewings } from '@/features/viewings/ViewingsProvider';
import type { RepoResult } from '@/features/shared/result';
import { clearSamples, demoLandlord, seedSamples } from './demoLandlordActions';

// DEMO ONLY. Plays the landlord's side with explicit buttons. Nothing here is a real landlord, and nothing
// happens automatically. Results appear in the app marked "Demo".
export function DemoLandlordControls() {
  const { user } = useSession();
  const messaging = useMessaging();
  const viewings = useViewings();
  const applications = useApplications();
  const notifications = useNotifications();
  const [status, setStatus] = useState<string | null>(null);
  // The landlords' own view of this student's conversations (independent of the student hiding or deleting them).
  const [landlordRows, setLandlordRows] = useState<Awaited<ReturnType<typeof demoLandlord.conversationsForStudent>>>([]);
  const loadLandlordRows = useCallback(async () => {
    if (user) setLandlordRows(await demoLandlord.conversationsForStudent(user.id));
  }, [user]);
  useEffect(() => {
    void loadLandlordRows();
  }, [loadLandlordRows, messaging.conversations, messaging.hiddenConversations]);
  const nowLocal = toLocalDateTime(new Date());
  const ids = [...landlordRows.map((r) => r.summary.conversation.propertyId), ...messaging.conversations.map((c) => c.conversation.propertyId), ...viewings.viewings.map((v) => v.propertyId), ...applications.applications.map((a) => a.propertyId)];
  const { byId } = usePropertiesById(ids);

  if (!user) return null;
  const title = (propertyId: string) => byId[propertyId]?.title ?? propertyId;
  const refreshAll = async () => {
    await Promise.all([messaging.refresh(), viewings.refresh(), applications.refresh(), notifications.refresh(), loadLandlordRows()]);
  };
  const act = (label: string, fn: () => unknown) => async () => {
    const r = (await fn()) as Partial<RepoResult<unknown>> | undefined;
    const message = r && r.ok === false ? r.error?.message ?? 'failed' : null;
    setStatus(message ? `${label}: ${message}` : `${label}: done (simulated).`);
    await refreshAll();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.lg }}>
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.title}>Demo landlord</Text>
          </View>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>DEMO ONLY. These buttons pretend to be a landlord. No real landlord exists, nothing is sent to anyone, and nothing happens unless you press a button.</Text>
          </View>
          {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.section}>Sample data</Text>
            <Button variant="outline" label="Add sample conversations, viewings and an application" onPress={act('Sample data', () => seedSamples(user))} />
            <Button variant="outline" label="Remove all my conversations, viewings and applications" onPress={act('Removed', () => clearSamples(user.id))} />
          </View>

          <Text style={styles.section}>Conversations (the landlord's side)</Text>
          <Text style={styles.muted}>These come from each landlord's own conversation list, so a conversation stays here even when the student hides or deletes it. A reply brings it back into the student's inbox.</Text>
          {landlordRows.length === 0 ? <Text style={styles.muted}>None yet. Message a landlord from a home’s page, or add the sample data.</Text> : null}
          {landlordRows.map((r) => (
            <View key={r.summary.conversation.id} style={styles.card}>
              <Text style={styles.name}>{title(r.summary.conversation.propertyId)}</Text>
              <Text style={styles.muted}>In the student's inbox: {r.studentInbox === 'visible' ? 'Visible' : r.studentInbox === 'hidden' ? 'Hidden' : 'Deleted'}</Text>
              <Button variant="outline" label="Landlord replies (demo)" onPress={act('Reply', () => demoLandlord.reply(r.summary.conversation.id, r.summary.conversation.ownerId))} />
            </View>
          ))}

          <Text style={styles.section}>Viewing requests</Text>
          {viewings.viewings.length === 0 ? <Text style={styles.muted}>None yet.</Text> : null}
          {viewings.viewings.map((v) => (
            <View key={v.id} style={styles.card}>
              <Text style={styles.name}>{title(v.propertyId)}</Text>
              <Text style={styles.muted}>{describeStart(effectiveStart(v))} · {statusLabel(v, nowLocal)}</Text>
              {v.status === 'pending' ? (
                <>
                  <Button variant="outline" label="Landlord confirms (demo)" onPress={act('Confirm', () => demoLandlord.confirmViewing(v))} />
                  <Button variant="outline" label="Landlord suggests another time (demo)" onPress={act('Propose', () => demoLandlord.proposeAlternative(v))} />
                  <Button variant="outline" label="Landlord declines (demo)" onPress={act('Decline', () => demoLandlord.declineViewing(v))} />
                </>
              ) : v.status === 'alternative_proposed' ? (
                <Button variant="outline" label="Landlord suggests a different time (demo)" onPress={act('Propose', () => demoLandlord.proposeAlternative(v))} />
              ) : (
                <Text style={styles.muted}>No landlord action available in this state.</Text>
              )}
            </View>
          ))}

          <Text style={styles.section}>Rental applications</Text>
          {applications.applications.length === 0 ? <Text style={styles.muted}>None yet.</Text> : null}
          {applications.applications.map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.name}>{title(a.propertyId)}</Text>
              <Text style={styles.muted}>{STATUS_LABEL[a.status]}</Text>
              {a.status === 'submitted' ? <Button variant="outline" label="Landlord starts review (demo)" onPress={act('Review', () => demoLandlord.respondToApplication(a.id, a.ownerId, { type: 'start_review' }))} /> : null}
              {a.status === 'submitted' || a.status === 'under_review' ? (
                <>
                  <Button variant="outline" label="Landlord accepts (demo)" onPress={act('Accept', () => demoLandlord.respondToApplication(a.id, a.ownerId, { type: 'accept' }))} />
                  <Button variant="outline" label="Landlord rejects (demo)" onPress={act('Reject', () => demoLandlord.respondToApplication(a.id, a.ownerId, { type: 'reject' }))} />
                </>
              ) : null}
            </View>
          ))}
        </ContentContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { fontSize: 24, color: colors.text },
  banner: { backgroundColor: colors.warning, borderRadius: radius.md, padding: spacing.md },
  bannerText: { fontSize: 12, color: '#8A5A00', lineHeight: 18 },
  status: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  section: { fontSize: 14, fontWeight: '700', color: colors.text },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.muted },
});
