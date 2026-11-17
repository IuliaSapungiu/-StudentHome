import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { ContentContainer } from '@/components/ContentContainer';
import { EmptyState } from '@/components/EmptyState';
import { PropertyCard } from '@/components/PropertyCard';
import { usePropertiesById } from '@/hooks/use-properties-by-ids';
import { useResponsive } from '@/hooks/use-responsive';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useSaved } from '@/features/saved/SavedProvider';

// Saved homes, most recently saved first. The list is the account's own saved set (persisted per account).
export default function SavedScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const layout = useResponsive();
  const { savedIds, ready, toggleSaved } = useSaved();
  const { byId, loaded } = usePropertiesById(savedIds);
  const columns = layout.columns;
  const available = savedIds.filter((id) => byId[id]);
  const unavailable = loaded ? savedIds.filter((id) => !byId[id]) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        key={columns}
        data={available.map((id) => byId[id])}
        keyExtractor={(p) => p.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: layout.gap } : undefined}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ContentContainer style={{ gap: spacing.md, paddingBottom: spacing.md }}>
            <Text style={styles.title}>Saved</Text>
            {savedIds.length > 0 && (
              <View style={styles.banner}>
                <Ionicons name="heart" size={18} color={colors.primary} />
                <Text style={styles.bannerText}>{savedIds.length} saved {savedIds.length === 1 ? 'home' : 'homes'}</Text>
              </View>
            )}
          </ContentContainer>
        }
        renderItem={({ item }) => (
          <View style={{ width: columns > 1 ? layout.gridItemWidth : '100%', paddingHorizontal: columns > 1 ? 0 : layout.gutter, maxWidth: columns > 1 ? undefined : layout.contentMaxWidth, alignSelf: 'center' }}>
            <PropertyCard property={item} width={columns > 1 ? layout.gridItemWidth : undefined} />
          </View>
        )}
        ListFooterComponent={
          unavailable.length > 0 ? (
            <ContentContainer style={{ gap: spacing.sm }}>
              <Text style={styles.sectionTitle}>No longer available</Text>
              {unavailable.map((id) => (
                <View key={id} style={styles.gone}>
                  <Text style={styles.goneText}>This home is no longer listed.</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Remove from saved" onPress={() => toggleSaved(id)} hitSlop={8}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </ContentContainer>
          ) : undefined
        }
        ListEmptyComponent={
          ready && loaded && unavailable.length === 0 ? (
            <ContentContainer>
              <EmptyState icon="heart-outline" title="No saved homes yet" text="Tap the heart on a home to keep it here, so it is easy to find again." actionLabel="Browse homes" onAction={() => router.push('/search')} />
            </ContentContainer>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  title: { fontSize: 28, color: colors.text, marginTop: spacing.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.mint, borderRadius: radius.md, padding: spacing.md },
  bannerText: { fontSize: 13, fontWeight: '600', color: colors.text },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: spacing.md },
  gone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  goneText: { fontSize: 13, color: colors.muted },
  remove: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
