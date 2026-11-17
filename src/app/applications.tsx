import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PropertyImage } from '@/components/PropertyImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { ApplicationStatusBadge } from '@/components/ApplicationStatusBadge';
import { BackButton } from '@/components/BackButton';
import { ContentContainer } from '@/components/ContentContainer';
import { EmptyState } from '@/components/EmptyState';
import { usePropertiesById } from '@/hooks/use-properties-by-ids';
import { formatDateLong, localDate } from '@/lib/dateTime';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useApplications } from '@/features/applications/ApplicationsProvider';
import { applicationGroup, STATUS_LABEL } from '@/features/applications/applicationRules';
import type { RentalApplication } from '@/features/applications/types';

// The student's rental applications, newest first. Each one is for a single home.
export default function ApplicationsScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { applications, ready } = useApplications();
  const { byId } = usePropertiesById(applications.map((a) => a.propertyId));
  const sorted = [...applications].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const renderCard = (a: RentalApplication) => {
    const p = byId[a.propertyId];
    const done = applicationGroup(a.status) === 'completed';
    const accepted = a.status === 'accepted';
    // Completed applications are calmer than active ones. Accepted keeps its positive green accent; rejected and
    // withdrawn go neutral. The status badge itself is never dimmed, so it stays fully readable.
    return (
      <Pressable
        key={a.id}
        accessibilityRole="button"
        accessibilityLabel={`${p?.title ?? 'Listing'}, ${STATUS_LABEL[a.status]}`}
        onPress={() => router.push({ pathname: '/application/[id]', params: { id: a.id } })}
        style={[styles.card, done && styles.cardDone, accepted && styles.cardAccepted]}>
        <View style={styles.row}>
          <View style={done && !accepted ? styles.dim : undefined}>
            {p ? <PropertyImage compact uri={p.images[0]} style={styles.thumb} /> : <View style={styles.thumb} />}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.cardTitle, done && !accepted && styles.titleDone]} numberOfLines={2}>{p?.title ?? 'This listing is no longer available'}</Text>
            <Text style={styles.sub}>Move-in {formatDateLong(a.preferredMoveIn)} · {a.leaseMonths} months</Text>
            <Text style={styles.sub}>Updated {formatDateLong(localDate(new Date(a.updatedAt)))}</Text>
          </View>
          <ApplicationStatusBadge status={a.status} />
        </View>
        {accepted ? <Text style={styles.accepted}>The landlord is interested in going ahead. Open the application to continue in Messages. Nothing is reserved yet.</Text> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.md }}>
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.title}>Applications</Text>
          </View>
          <Text style={styles.muted}>An application is an expression of interest. It is not a booking, and it never reserves a home.</Text>

          {ready && sorted.length === 0 ? (
            <EmptyState icon="document-text-outline" title="No applications yet" text="When you find a home you would like to rent, open it and choose “Apply to rent”." actionLabel="Browse homes" onAction={() => router.push('/search')} />
          ) : null}

          {(['active', 'completed'] as const).map((group) => {
            const list = sorted.filter((a) => applicationGroup(a.status) === group);
            if (list.length === 0) return null;
            return (
              <View key={group} style={{ gap: spacing.md }}>
                <Text style={styles.groupTitle} accessibilityRole="header">{group === 'active' ? `Active (${list.length})` : `Completed (${list.length})`}</Text>
                {list.map((a) => renderCard(a))}
              </View>
            );
          })}
        </ContentContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { fontSize: 24, color: colors.text },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  cardDone: { backgroundColor: '#F7F8F7', borderColor: '#E3E8E5' },
  cardAccepted: { borderColor: colors.primary, backgroundColor: '#F4FAF6' },
  dim: { opacity: 0.6 },
  titleDone: { color: '#5F6B66' },
  groupTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.mint },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
  accepted: { fontSize: 12, color: colors.primary, lineHeight: 17 },
});
