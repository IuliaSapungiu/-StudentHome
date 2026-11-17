import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PropertyImage } from '@/components/PropertyImage';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import type { Property } from '@/data';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { formatShortDateTime } from '@/lib/dateTime';
import { useViewings } from '@/features/viewings/ViewingsProvider';
import { bucketOf, currentProposal, describeStart, describeTimeline, effectiveStart, isPast, originalRequestedStart, statusLabel } from '@/features/viewings/viewingRules';
import type { ViewingRequest } from '@/features/viewings/types';
import { viewingTone } from './viewingTone';

type Props = {
  viewing: ViewingRequest;
  property: Property | undefined;
  nowLocal: string;
  busy: boolean;
  /** This is the viewing a notification or link pointed at. */
  highlighted: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onAcceptAlternative: () => void;
  onRejectAlternative: () => void;
  onMessage: () => void;
};

// One viewing in the student's Viewings list. The exact address appears only once the viewing is confirmed.
// The full history (original request and every proposed time, each with its outcome) is one tap away.
export function ViewingCard({ viewing: v, property, nowLocal, busy, highlighted, onCancel, onReschedule, onAcceptAlternative, onRejectAlternative, onMessage }: Props) {
  const { getConfirmedAddress } = useViewings();
  const [address, setAddress] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const bucket = bucketOf(v, nowLocal);
  const start = effectiveStart(v);
  const cur = currentProposal(v);
  const open = v.status === 'pending' || v.status === 'alternative_proposed';
  const confirmedFuture = v.status === 'confirmed' && bucket === 'upcoming';
  const proposalPassed = isPast(cur.start, nowLocal);

  useEffect(() => {
    let alive = true;
    if (v.status === 'confirmed') getConfirmedAddress(v.id).then((a) => alive && setAddress(a));
    else setAddress(null);
    return () => {
      alive = false;
    };
  }, [v.id, v.status, getConfirmedAddress]);

  const landlord = property?.owner.displayName;
  const rows = describeTimeline(v, nowLocal);
  return (
    <View style={[styles.card, highlighted && styles.cardOn]}>
      {highlighted ? <Text style={styles.updated}>Updated</Text> : null}
      <View style={styles.top}>
        <StatusBadge label={statusLabel(v, nowLocal)} tone={viewingTone(v, nowLocal)} />
        <Text style={[styles.time, bucket === 'past' && styles.timePast]}>{start.slice(11)}</Text>
      </View>

      <View style={styles.home}>
        {property ? <PropertyImage compact uri={property.images[0]} style={styles.thumb} /> : <View style={styles.thumb} />}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title} numberOfLines={2}>{property?.title ?? 'This listing is no longer available'}</Text>
          {landlord ? <Text style={styles.sub}>With {landlord}</Text> : null}
        </View>
      </View>

      {v.status === 'alternative_proposed' ? (
        <View style={styles.alt}>
          <Text style={styles.altTitle}>The landlord suggested another time</Text>
          <Text style={[styles.altText, proposalPassed && styles.passed]}>{describeStart(cur.start)}{proposalPassed ? ' · time has passed' : ''}</Text>
          <Text style={styles.altNote}>You asked for {describeStart(originalRequestedStart(v))}. The viewing is only confirmed once you accept the new time.</Text>
        </View>
      ) : null}

      <View style={styles.divider} />
      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={16} color={colors.primary} />
        <View style={{ flex: 1 }}>
          {v.status === 'confirmed' && address ? (
            <>
              <Text style={styles.address}>{address}</Text>
              <Text style={styles.fine}>Full address is now available</Text>
            </>
          ) : (
            <>
              <Text style={styles.address}>{property ? `${property.area}, ${property.city}` : 'Area not available'}</Text>
              <Text style={styles.fine}>The exact address is shared once the viewing is confirmed.</Text>
            </>
          )}
        </View>
      </View>
      {open && !proposalPassed ? <Text style={styles.mock}>This is the time you asked for. The landlord has not confirmed it yet.</Text> : null}

      {(open || confirmedFuture) && !confirmingCancel ? (
        <View style={styles.actions}>
          {v.status === 'alternative_proposed' ? (
            proposalPassed ? (
              <View style={styles.action}><Button label="This time has passed" onPress={() => undefined} disabled /></View>
            ) : (
              <>
                <View style={styles.action}><Button label="Accept new time" onPress={onAcceptAlternative} loading={busy} /></View>
                <View style={styles.action}><Button variant="outline" label="Reject new time" onPress={onRejectAlternative} disabled={busy} /></View>
              </>
            )
          ) : null}
          <View style={styles.action}><Button variant="outline" label="Reschedule" onPress={onReschedule} disabled={busy} /></View>
          {confirmedFuture || v.status === 'alternative_proposed' ? (
            <View style={styles.action}><Button variant="outline" label="Message landlord" onPress={onMessage} disabled={busy} /></View>
          ) : null}
          <View style={styles.action}>
            <Button variant="outline" label={v.status === 'confirmed' ? 'Cancel viewing' : 'Cancel request'} onPress={() => setConfirmingCancel(true)} disabled={busy} />
          </View>
        </View>
      ) : null}

      {confirmingCancel ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.confirm}>Cancel this viewing? The landlord will see that you cancelled.</Text>
          <View style={styles.actions}>
            <View style={styles.action}><Button variant="outline" label="Keep it" onPress={() => setConfirmingCancel(false)} /></View>
            <View style={styles.action}><Button variant="dark" label="Yes, cancel" onPress={() => { setConfirmingCancel(false); onCancel(); }} loading={busy} /></View>
          </View>
        </View>
      ) : null}

      <Text accessibilityRole="button" onPress={() => setShowHistory((o) => !o)} style={styles.historyToggle}>
        {showHistory ? 'Hide history' : `Show history (${rows.length} ${rows.length === 1 ? 'time' : 'times'})`}
      </Text>
      {showHistory ? (
        <View style={styles.history} accessibilityLabel="Viewing history">
          {rows.map((r) => (
            <View key={r.proposalId} style={styles.row}>
              <View style={[styles.dot, r.inactive && styles.dotOff]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowTitle, r.inactive && styles.inactive]}>{r.text}</Text>
                <Text style={[styles.rowTime, r.inactive && styles.inactive, r.past && styles.passed]}>{formatShortDateTime(r.start)}{r.past ? ' · past' : ''}</Text>
                <Text style={styles.rowOutcome}>{r.outcomeText}{r.inactive && r.outcome === 'active' ? '' : r.inactive ? ' · no longer active' : ''}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md },
  cardOn: { borderColor: colors.primary, borderWidth: 2 },
  updated: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: '#fff', backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 20, fontWeight: '700', color: colors.text },
  timePast: { color: '#B8C2BC' },
  home: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.mint },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
  alt: { backgroundColor: '#E3ECFB', borderRadius: radius.md, padding: spacing.md, gap: 4 },
  altTitle: { fontSize: 12, fontWeight: '700', color: '#2B55A6' },
  altText: { fontSize: 15, fontWeight: '700', color: colors.text },
  altNote: { fontSize: 11, color: colors.muted },
  passed: { color: '#B8C2BC', textDecorationLine: 'line-through' },
  divider: { height: 1, backgroundColor: colors.border },
  addressRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  address: { fontSize: 13, color: colors.text },
  fine: { fontSize: 11, color: colors.muted },
  mock: { fontSize: 11, color: '#8A5A00' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
  confirm: { fontSize: 13, color: colors.text },
  historyToggle: { fontSize: 12, fontWeight: '700', color: colors.primary, paddingVertical: 4 },
  history: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  dotOff: { backgroundColor: '#C3CBC6' },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  rowTime: { fontSize: 13, color: colors.text },
  rowOutcome: { fontSize: 11, color: colors.muted },
  inactive: { color: '#9AA5A0' },
});
