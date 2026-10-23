import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import {
  describeDetail,
  formatNumber,
  isDemo,
  isVerified,
  propertyRepository,
  showsDemoData,
  type CitySummary,
  type Property,
} from '@/data';
import { ContentContainer } from '@/components/ContentContainer';
import { useSession } from '@/features/session/SessionProvider';
import { greetingFor } from '@/features/session/sessionLogic';
import { DemoNotice } from '@/components/DemoNotice';
import { DemoTag } from '@/components/DemoTag';
import { PropertyCard } from '@/components/PropertyCard';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useSaved } from '@/features/saved/SavedProvider';
import { HOME_UNIVERSITY, presetAll, presetCity, presetNearUniversity, presetUnderBudget, type SearchPreset } from '@/features/search/presets';
import { useSearch } from '@/features/search/SearchProvider';
import { QUICK_BUDGET_RON } from '@/features/search/searchState';

type HomeData = { featured: Property[]; cities: CitySummary[]; nearAse: Property[] };

export default function HomeScreen() {
  const layout = useResponsive();
  const router = useRouter();
  const { user } = useSession();
  const { applyPreset, formatPrice, formatBudgetRon } = useSearch();
  const { isSaved, toggleSaved } = useSaved();
  const [data, setData] = useState<HomeData | null>(null);

  // Every entry point starts a fresh search from a preset, then opens the Search tab.
  const openSearch = (preset: SearchPreset, opts?: { focus?: boolean }) => {
    applyPreset(preset, opts);
    router.navigate('/search');
  };
  const chips = [
    { icon: 'school-outline', label: `Near ${HOME_UNIVERSITY}`, onPress: () => openSearch(presetNearUniversity(HOME_UNIVERSITY)) },
    { icon: 'calendar-outline', label: 'Move-in date', onPress: () => router.push('/filters') },
    { icon: 'cash-outline', label: `Under ${formatBudgetRon(QUICK_BUDGET_RON)}`, onPress: () => openSearch(presetUnderBudget(QUICK_BUDGET_RON)) },
  ] as const;

  useEffect(() => {
    let alive = true;
    Promise.all([
      propertyRepository.getFeatured(6),
      propertyRepository.getCities(),
      propertyRepository.search({ university: 'ASE' }),
    ]).then(([featured, cities, nearAse]) => alive && setData({ featured, cities, nearAse }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero: full-width background, centred content */}
        <View style={styles.hero}>
          <ContentContainer style={{ gap: spacing.sm }}>
            <Text style={styles.greeting}>{greetingFor(user)}</Text>
            <Text style={[styles.headline, layout.isSmallPhone && styles.headlineSmall]}>Find your place.</Text>
            <Text style={[styles.headline, layout.isSmallPhone && styles.headlineSmall, { color: colors.primary }]}>
              Start your student life.
            </Text>

            <Pressable accessibilityRole="search" accessibilityLabel="Find your home" onPress={() => openSearch(presetAll(), { focus: true })} style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.searchTitle}>Find your home</Text>
                <Text style={styles.searchHint}>City, university or neighborhood</Text>
              </View>
              <Ionicons name="options-outline" size={22} color={colors.primary} />
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {chips.map((c) => (
                <Pressable key={c.label} accessibilityRole="button" onPress={c.onPress} style={styles.chip}>
                  <Ionicons name={c.icon} size={14} color={colors.primaryDark} />
                  <Text style={styles.chipText}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </ContentContainer>
        </View>

        {showsDemoData && (
          <ContentContainer style={{ marginTop: spacing.md }}>
            <DemoNotice />
          </ContentContainer>
        )}

        {data && (
          <>
            <SectionHeader title="Featured for you" action="See all" onPress={() => openSearch(presetAll())} />
            <ContentContainer padded={false}>
              <FlatList
                horizontal
                data={data.featured}
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: layout.gap }}
                renderItem={({ item }) => <PropertyCard property={item} width={layout.carouselCardWidth} />}
              />
            </ContentContainer>

            <SectionHeader title="Popular student cities" action="Explore" onPress={() => openSearch(presetAll())} />
            <ContentContainer padded={false}>
              <FlatList
                horizontal
                data={data.cities}
                keyExtractor={(c) => c.name}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: layout.gap }}
                renderItem={({ item }) => (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Homes in ${item.name}`} onPress={() => openSearch(presetCity(item.name))}>
                    <Image source={{ uri: item.image }} style={styles.cityImage} />
                    <Text style={styles.cityName}>{item.name}</Text>
                    <Text style={styles.cityHomes}>{formatNumber(item.homeCount)} homes</Text>
                  </Pressable>
                )}
              />
            </ContentContainer>

            <SectionHeader title={`Recommended near ${HOME_UNIVERSITY}`} action="See all" onPress={() => openSearch(presetNearUniversity(HOME_UNIVERSITY))} />
            <ContentContainer style={[styles.grid, { gap: layout.gap, marginBottom: spacing.xl }]}>
              {data.nearAse.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.title}, ${formatPrice(p.rent)} per month`}
                  onPress={() => router.push({ pathname: '/property/[id]', params: { id: p.id } })}
                  style={[styles.listRow, { width: layout.gridItemWidth }]}>
                  <View>
                    <Image source={{ uri: p.images[0] }} style={styles.thumb} />
                    {isVerified(p) && <VerifiedBadge variant="shield" demo={isDemo(p)} style={styles.thumbBadge} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.meta}>{p.area}, {p.city}</Text>
                    <Text style={styles.listTitle} numberOfLines={2}>{p.title}</Text>
                    <Text style={styles.meta}>{describeDetail(p)}</Text>
                    <Text style={styles.price}>{formatPrice(p.rent)} <Text style={styles.meta}>/ month</Text></Text>
                    {isDemo(p) && <DemoTag />}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isSaved(p.id) ? 'Remove from saved' : 'Save home'}
                    hitSlop={10}
                    onPress={() => toggleSaved(p.id)}>
                    <Ionicons name={isSaved(p.id) ? 'heart' : 'heart-outline'} size={22} color={isSaved(p.id) ? colors.primary : colors.text} />
                  </Pressable>
                </Pressable>
              ))}
            </ContentContainer>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <ContentContainer style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onPress} hitSlop={8}>
        <Text style={styles.sectionAction}>{action} ›</Text>
      </Pressable>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  hero: { backgroundColor: colors.mint, paddingVertical: spacing.lg, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  greeting: { fontSize: 13, color: colors.muted },
  headline: { fontSize: 32, lineHeight: 38, color: colors.text },
  headlineSmall: { fontSize: 27, lineHeight: 33 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  searchTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  searchHint: { fontSize: 12, color: colors.muted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, color: colors.primaryDark },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontSize: 22, color: colors.text },
  sectionAction: { fontSize: 13, fontWeight: '600', color: colors.primary },
  cityImage: { width: 130, height: 110, borderRadius: radius.md },
  cityName: { fontSize: 13, fontWeight: '600', marginTop: 6, color: colors.text },
  cityHomes: { fontSize: 11, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  listRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  thumbBadge: { position: 'absolute', top: 6, left: 6 },
  listTitle: { fontSize: 15, color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  price: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
});
