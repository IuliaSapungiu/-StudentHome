import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { ContentContainer } from '@/components/ContentContainer';
import { EmptyState } from '@/components/EmptyState';
import { ViewingCard } from '@/components/viewings/ViewingCard';
import { usePropertiesById } from '@/hooks/use-properties-by-ids';
import { formatDateLong, toLocalDateTime } from '@/lib/dateTime';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useOpenConversation } from '@/features/messaging/useOpenConversation';
import { useViewings } from '@/features/viewings/ViewingsProvider';
import { bucketOf, effectiveStart, groupByDay, resolveViewingFocus, sortForTab } from '@/features/viewings/viewingRules';
import type { ViewingTab } from '@/features/viewings/types';

const TABS: { key: ViewingTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'past', label: 'Past' },
];

// The student's FORMAL viewing requests. (Viewings arranged only by chatting are not listed here.)
// `?viewingId=` opens one exact viewing: the right tab is selected and the card is highlighted and scrolled into view.
// Route is /my-viewings because the landlord tab already owns the /viewings path.
export default function MyViewingsScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { viewingId } = useLocalSearchParams<{ viewingId?: string }>();
  const { viewings, ready, cancel, acceptAlternative, rejectAlternative } = useViewings();
  const { byId } = usePropertiesById(viewings.map((v) => v.propertyId));
  const messageGate = useOpenConversation();
  const [tab, setTab] = useState<ViewingTab>('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const cardY = useRef<Record<string, number>>({}); // position inside its day group
  const groupY = useRef<Record<string, number>>({}); // position of each day group
  const handled = useRef<string | null>(null);

  const nowLocal = toLocalDateTime(new Date());
  const buckets = useMemo(() => {
    const out: Record<ViewingTab, typeof viewings> = { upcoming: [], pending: [], past: [] };
    for (const v of viewings) out[bucketOf(v, nowLocal)].push(v);
    return { upcoming: sortForTab(out.upcoming, 'upcoming'), pending: sortForTab(out.pending, 'pending'), past: sortForTab(out.past, 'past') };
  }, [viewings, nowLocal]);
  const groups = groupByDay(buckets[tab]);

  // Open the exact viewing from a link or notification: pick its tab, highlight it, and scroll to it.
  useEffect(() => {
    if (!ready || !viewingId || handled.current === viewingId) return;
    handled.current = viewingId;
    const focus = resolveViewingFocus(viewings, viewingId, toLocalDateTime(new Date()));
    if (focus.found) {
      setTab(focus.tab);
      setFocusId(focus.viewing.id);
      setMissing(false);
    } else setMissing(true);
  }, [ready, viewingId, viewings]);

  const scrollToFocus = () => {
    const v = viewings.find((x) => x.id === focusId);
    if (!v) return;
    const day = effectiveStart(v).slice(0, 10);
    const y = (groupY.current[day] ?? 0) + (cardY.current[v.id] ?? 0);
    scroller.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
  };
  useEffect(() => {
    const t = setTimeout(scrollToFocus, 150);
    return () => clearTimeout(t);
  }, [focusId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (id: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setBusyId(id);
    setError(null);
    const r = await action();
    setBusyId(null);
    if (!r.ok) setError(r.error?.message ?? 'Something went wrong.');
    else {
      // Follow the viewing to wherever it now belongs (for example Pending -> Upcoming after accepting).
      const focus = resolveViewingFocus(viewings, id, nowLocal);
      if (focus.found) setFocusId(id);
    }
  };

  // After an update the viewing may belong to another tab: keep it in view.
  useEffect(() => {
    if (!focusId) return;
    const focus = resolveViewingFocus(viewings, focusId, toLocalDateTime(new Date()));
    if (focus.found && focus.tab !== tab && busyId === null && handled.current !== null) setTab(focus.tab);
  }, [viewings]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView ref={scroller} contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.md }}>
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.title}>Viewings</Text>
          </View>

          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map((t) => (
              <Text
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.key }}
                onPress={() => setTab(t.key)}
                style={[styles.tab, tab === t.key && styles.tabOn]}>
                {t.label}{buckets[t.key].length > 0 ? ` (${buckets[t.key].length})` : ''}
              </Text>
            ))}
          </View>
          {missing ? <Text style={styles.error}>That viewing is no longer available.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {ready && groups.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title={tab === 'upcoming' ? 'No upcoming viewings' : tab === 'pending' ? 'Nothing waiting for an answer' : 'No past viewings'}
              text="Open a home and choose “Request viewing”. You can also just message a landlord to arrange a time."
              actionLabel="Browse homes"
              onAction={() => router.push('/search')}
            />
          ) : null}

          {groups.map((g) => (
            <View key={g.date} style={{ gap: spacing.sm }} onLayout={(e) => { groupY.current[g.date] = e.nativeEvent.layout.y; }}>
              <Text style={styles.day}>{formatDateLong(g.date).replace(', ', ' · ')}</Text>
              {g.items.map((v) => (
                <View key={v.id} onLayout={(e) => { cardY.current[v.id] = e.nativeEvent.layout.y; }}>
                  <ViewingCard
                    viewing={v}
                    property={byId[v.propertyId]}
                    nowLocal={nowLocal}
                    busy={busyId === v.id}
                    highlighted={focusId === v.id}
                    onCancel={() => run(v.id, () => cancel(v.id))}
                    onAcceptAlternative={() => run(v.id, () => acceptAlternative(v.id))}
                    onRejectAlternative={() => run(v.id, () => rejectAlternative(v.id))}
                    onReschedule={() => router.push({ pathname: '/request-viewing', params: { rescheduleId: v.id } })}
                    onMessage={() => messageGate.open(v.propertyId, 'viewings')}
                  />
                </View>
              ))}
            </View>
          ))}
        </ContentContainer>
      </ScrollView>
      {messageGate.sheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { fontSize: 24, color: colors.text },
  tabs: { flexDirection: 'row', backgroundColor: '#EEF1EE', borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, textAlign: 'center', paddingVertical: 10, fontSize: 12, fontWeight: '600', color: colors.muted, borderRadius: radius.sm, overflow: 'hidden' },
  tabOn: { backgroundColor: '#fff', color: colors.text },
  day: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: spacing.sm },
  error: { fontSize: 13, color: '#D64545' },
});
