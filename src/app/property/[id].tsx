import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import {
  describeAmenity,
  describeAvailability,
  describePropertyType,
  describeProviderType,
  describeSize,
  isDemo,
  isVerified,
  propertyRepository,
  type Amenity,
  type Property,
} from '@/data';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { DemoTag } from '@/components/DemoTag';
import { PhotoGallery } from '@/components/property/PhotoGallery';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { formatMoney, formatRate } from '@/features/currency/format';
import { useSaved } from '@/features/saved/SavedProvider';
import { useSearch } from '@/features/search/SearchProvider';
import { useVerifiedActionGate } from '@/features/verification/useVerifiedActionGate';
import { toIsoDate } from '@/lib/dates';

type Load = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; property: Property };

const AMENITY_ICON: Record<Amenity, keyof typeof Ionicons.glyphMap> = {
  furnished: 'bed-outline',
  bills_included: 'receipt-outline',
  private_bathroom: 'water-outline',
  wifi: 'wifi-outline',
  washing_machine: 'shirt-outline',
  parking: 'car-outline',
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Keyed by id so opening a different home starts from a clean "loading" state.
  return <DetailLoader key={String(id)} id={String(id)} />;
}

function DetailLoader({ id }: { id: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    propertyRepository.getById(id).then((property) => alive && setLoad(property ? { status: 'ready', property } : { status: 'missing' }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (load.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (load.status === 'missing') return <NotFound />;
  return <Detail property={load.property} />;
}

function NotFound() {
  return (
    <View style={[styles.center, { gap: spacing.md, padding: spacing.lg }]}>
      <Text style={styles.h1}>This home isn’t available</Text>
      <Text style={styles.muted}>It may have been removed or is no longer listed.</Text>
      <BackButton />
    </View>
  );
}

function Detail({ property: p }: { property: Property }) {
  const insets = useSafeAreaInsets();
  const layout = useResponsive();
  const { displayPrice, formatPrice, rate, currency } = useSearch();
  const { isSaved, toggleSaved } = useSaved();
  const messageGate = useVerifiedActionGate('message');
  const viewingGate = useVerifiedActionGate('request_viewing');
  const [notice, setNotice] = useState<'message' | 'viewing' | null>(null);

  const wide = layout.width >= 700; // tablets and phones in landscape: gallery beside the details
  const saved = isSaved(p.id);
  const demo = isDemo(p);
  const rent = displayPrice(p.rent);
  const deposit = displayPrice(p.deposit);
  const today = toIsoDate(new Date());
  const converted = rent.converted || deposit.converted;
  const bedrooms = p.bedrooms === 0 ? 'Studio' : `${p.bedrooms} ${p.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`;
  const sideInsets = { paddingLeft: insets.left, paddingRight: insets.right };

  const gallery = (
    <View>
      <PhotoGallery images={p.images} aspectRatio={wide ? 1.25 : 1.35} rounded={wide} />
      <View style={[styles.overlayTop, { top: wide ? spacing.md : insets.top + spacing.sm, left: wide ? spacing.md : spacing.md + insets.left, right: wide ? spacing.md : spacing.md + insets.right }]} pointerEvents="box-none">
        {wide ? <View /> : <BackButton />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save home'}
          onPress={() => toggleSaved(p.id)}
          style={[styles.heart, saved && { backgroundColor: colors.primary }]}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? '#fff' : colors.text} />
        </Pressable>
      </View>
      <View style={[styles.overlayBottom, { left: spacing.md }]} pointerEvents="none">
        {isVerified(p) && <VerifiedBadge demo={demo} />}
        {demo && <DemoTag />}
      </View>
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      <View style={{ flex: 1 }}>
        <Button label="Message landlord" variant="outline" onPress={() => messageGate.run(() => setNotice('message'))} />
      </View>
      <View style={{ flex: 1 }}>
        <Button label="Request viewing" onPress={() => viewingGate.run(() => setNotice('viewing'))} />
      </View>
    </View>
  );

  const details = (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={styles.price} accessibilityLabel={`${formatPrice(p.rent)} per month`}>
          {formatMoney(rent.money, { approx: rent.converted })} <Text style={styles.perMonth}>/ month</Text>
        </Text>
        <Text style={styles.muted}>Deposit {formatMoney(deposit.money, { approx: deposit.converted })}</Text>
        {converted && (
          <Text style={styles.fine}>
            Listed by the landlord at {formatMoney(p.rent)}
            {p.deposit.currency !== p.rent.currency ? ` (deposit ${formatMoney(p.deposit)})` : ''}. Shown here in {currency === 'RON' ? 'lei' : 'euro'} at a demo rate of {formatRate(rate)}, which is not a live rate.
          </Text>
        )}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={styles.h1} accessibilityRole="header">{p.title}</Text>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={15} color={colors.muted} />
          <Text style={styles.muted}>{p.area}, {p.city}</Text>
        </View>
      </View>

      <View style={styles.facts}>
        <Fact icon="bed-outline" label={bedrooms} />
        <Fact icon="water-outline" label={`${p.bathrooms} ${p.bathrooms === 1 ? 'bathroom' : 'bathrooms'}`} />
        <Fact icon="home-outline" label={`${describePropertyType(p.type)}`} />
        <Fact icon="school-outline" label={`${p.nearestUniversity.minutes} min to ${p.nearestUniversity.name}`} />
      </View>

      <View style={styles.availability}>
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={styles.availabilityText}>{describeAvailability(p.availableFrom, today)}</Text>
      </View>

      <Section title="About this home">
        <Text style={styles.body}>{p.description}</Text>
        <Text style={styles.fine}>{describeSize(p)} in {p.area}.</Text>
      </Section>

      {p.amenities.length > 0 && (
        <Section title="Amenities">
          <View style={styles.amenities}>
            {p.amenities.map((a) => (
              <View key={a} style={styles.amenity}>
                <Ionicons name={AMENITY_ICON[a]} size={18} color={colors.primary} />
                <Text style={styles.amenityText}>{describeAmenity(a)}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      <Section title="Location">
        <Text style={styles.body}>{p.area}, {p.city}</Text>
        <Text style={styles.fine}>
          Only the area is shown. The exact address is shared after your viewing is confirmed.
          {demo ? ' Locations on demo listings are fictional.' : ''}
        </Text>
      </Section>

      <Section title={p.owner.providerType === 'private_landlord' ? 'Your landlord' : 'Offered by'}>
        <View style={styles.owner}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p.owner.displayName.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.ownerName}>{p.owner.displayName}</Text>
            <Text style={styles.muted}>{describeProviderType(p.owner.providerType)}{demo ? ' · fictional demo' : ''}</Text>
            {isVerified(p) && <VerifiedBadge variant="inline" demo={demo} />}
          </View>
        </View>
        {isVerified(p) && <Text style={styles.fine}>Identity verified. This is about the landlord, not about the property.</Text>}
      </Section>

      {notice && (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle-outline" size={20} color="#8A5A00" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.noticeTitle}>{notice === 'message' ? 'Messaging is coming in a later step' : 'Viewing requests are coming in a later step'}</Text>
            <Text style={styles.noticeText}>
              {notice === 'message'
                ? 'You are cleared to message landlords, but this feature is not built yet. No message was sent.'
                : 'You are cleared to request viewings, but this feature is not built yet. No request was made.'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      {wide ? (
        <ScrollView contentContainerStyle={[{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl + insets.bottom }, sideInsets]}>
          <View style={[styles.wideRow, { paddingHorizontal: layout.gutter, maxWidth: layout.contentMaxWidth }]}>
            <View style={styles.wideBack}>
              <BackButton />
            </View>
            <View style={{ flex: 11, gap: spacing.md }}>{gallery}</View>
            <View style={{ flex: 10, gap: spacing.lg }}>
              {details}
              {actions}
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
            {gallery}
            <View style={{ paddingHorizontal: layout.gutter + insets.left, paddingTop: spacing.lg }}>{details}</View>
          </ScrollView>
          <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md), paddingLeft: layout.gutter + insets.left, paddingRight: layout.gutter + insets.right }]}>
            {actions}
          </View>
        </>
      )}
      {messageGate.sheet}
      {viewingGate.sheet}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.h2} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

function Fact({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.factText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  overlayTop: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  overlayBottom: { position: 'absolute', bottom: spacing.md, gap: 6, alignItems: 'flex-start' },
  heart: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  wideRow: { width: '100%', alignSelf: 'center', flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  wideBack: { width: 44 },
  h1: { fontSize: 24, lineHeight: 30, color: colors.text },
  h2: { fontSize: 17, fontWeight: '600', color: colors.text },
  price: { fontSize: 28, fontWeight: '700', color: colors.text },
  perMonth: { fontSize: 14, fontWeight: '400', color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
  fine: { fontSize: 12, lineHeight: 17, color: colors.muted },
  body: { fontSize: 14, lineHeight: 21, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.mint, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  factText: { fontSize: 13, color: colors.text },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  availabilityText: { fontSize: 14, fontWeight: '600', color: colors.text },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  amenityText: { fontSize: 13, color: colors.text },
  owner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  ownerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.md, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.warning, borderRadius: radius.md, padding: spacing.md },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: '#6B4600' },
  noticeText: { fontSize: 12, lineHeight: 17, color: '#6B4600' },
});
