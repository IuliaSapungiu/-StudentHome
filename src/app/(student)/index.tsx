import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import {
  describeDetail,
  formatNumber,
  isDemo,
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

const chips = [
  { icon: 'school-outline', label: 'Near ASE' },
  { icon: 'calendar-outline', label: 'Move-in date' },
  { icon: 'cash-outline', label: 'Under 2.500 lei' },
] as const;

type HomeData = { featured: Property[]; cities: CitySummary[]; nearAse: Property[] };

export default function HomeScreen() {
  const layout = useResponsive();
  const { user } = useSession();
  const [data, setData] = useState<HomeData | null>(null);

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero: full-width background, centred content */}
        <View style={styles.hero}>
          <ContentContainer style={{ gap: spacing.sm }}>
            <Text style={styles.greeting}>{greetingFor(user)}</Text>
            <Text style={[styles.headline, layout.isSmallPhone && styles.headlineSmall]}>Find your place.</Text>
            <Text style={[styles.headline, layout.isSmallPhone && styles.headlineSmall, { color: colors.primary }]}>
              Start your student life.
            </Text>

            <Pressable style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.searchTitle}>Find your home</Text>
                <Text style={styles.searchHint}>City, university or neighborhood</Text>
              </View>
              <Ionicons name="options-outline" size={22} color={colors.primary} />
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {chips.map((c) => (
                <View key={c.label} style={styles.chip}>
                  <Ionicons name={c.icon} size={14} color={colors.primaryDark} />
                  <Text style={styles.chipText}>{c.label}</Text>
                </View>
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
            <SectionHeader title="Featured for you" action="See all" />
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

            <SectionHeader title="Popular student cities" action="Explore" />
            <ContentContainer padded={false}>
              <FlatList
                horizontal
                data={data.cities}
                keyExtractor={(c) => c.name}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: layout.gap }}
                renderItem={({ item }) => (
                  <View>
                    <Image source={{ uri: item.image }} style={styles.cityImage} />
                    <Text style={styles.cityName}>{item.name}</Text>
                    <Text style={styles.cityHomes}>{formatNumber(item.homeCount)} homes</Text>
                  </View>
                )}
              />
            </ContentContainer>

            <SectionHeader title="Recommended near ASE" action="See all" />
            <ContentContainer style={[styles.grid, { gap: layout.gap, marginBottom: spacing.xl }]}>
              {data.nearAse.map((p) => (
                <View key={p.id} style={[styles.listRow, { width: layout.gridItemWidth }]}>
                  <Image source={{ uri: p.images[0] }} style={styles.thumb} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.meta}>{p.area}, {p.city}</Text>
                    <Text style={styles.listTitle} numberOfLines={2}>{p.title}</Text>
                    <Text style={styles.meta}>{describeDetail(p)}</Text>
                    <Text style={styles.price}>{formatNumber(p.rentRon)} lei <Text style={styles.meta}>/ month</Text></Text>
                    {isDemo(p) && <DemoTag />}
                  </View>
                  <Ionicons name="heart-outline" size={22} color={colors.text} />
                </View>
              ))}
            </ContentContainer>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, action }: { title: string; action: string }) {
  return (
    <ContentContainer style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionAction}>{action} ›</Text>
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
  listTitle: { fontSize: 15, color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  price: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
});
