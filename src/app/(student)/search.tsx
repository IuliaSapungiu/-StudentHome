import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { propertyRepository, showsDemoData, type Property } from '@/data';
import { DemoNotice } from '@/components/DemoNotice';
import { PropertyCard } from '@/components/PropertyCard';
import PropertyMap from '@/components/map/PropertyMap';
import { Chip } from '@/components/search/Chip';
import { EmptyResults } from '@/components/search/EmptyResults';
import { SortMenu } from '@/components/search/SortMenu';
import { ViewToggle } from '@/components/search/ViewToggle';
import { useSearch } from '@/features/search/SearchProvider';
import { searchStateFromParams, parseSearchParams } from '@/features/search/params';
import {
  QUICK_BUDGET_RON,
  activeFilterChips,
  activeFilterCount,
  clearAll,
  describeResultCount,
  isQuickChipActive,
  queryKey,
  removeFilter,
  summarizeFilters,
  toQuery,
  toggleQuickChip,
  type QuickChipId,
} from '@/features/search/searchState';

type Loaded = { key: string; items: Property[] };

export default function SearchScreen() {
  const layout = useResponsive();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { state, setState, setView, focusNonce, formatBudgetRon } = useSearch();
  const inputRef = useRef<TextInput>(null);

  // ---- Deep links such as /search?city=Cluj-Napoca (invalid values are ignored) ----
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    if (Object.keys(parseSearchParams(params)).length > 0) setState(searchStateFromParams(params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  // ---- Text field: typed text is committed after a short pause (or on submit) ----
  const [text, setText] = useState(state.text);
  const [syncedText, setSyncedText] = useState(state.text);
  const typed = useRef(false);
  const debouncedText = useDebouncedValue(text, 250);
  if (syncedText !== state.text) {
    // presets and "clear all" change the search from outside: the field follows
    setSyncedText(state.text);
    setText(state.text);
  }
  useEffect(() => {
    if (!typed.current) return;
    typed.current = false;
    setState((prev) => ({ ...prev, text: debouncedText }));
  }, [debouncedText, setState]);
  useEffect(() => {
    if (focusNonce > 0) inputRef.current?.focus();
  }, [focusNonce]);

  // ---- Results: ONE array feeds the count, the list and the map ----
  const key = queryKey(state);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let alive = true;
    propertyRepository.search(toQuery(state)).then((items) => alive && setLoaded({ key, items }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = loaded && loaded.key === key ? loaded.items : null;
  const shown = current ?? loaded?.items ?? null;
  const filterCount = activeFilterCount(state);

  const [pickedId, setSelectedId] = useState<string | null>(null);
  const [previewHeight, setPreviewHeight] = useState(0);
  // A selection only counts while that home is still in the results.
  const selectedId = pickedId && shown?.some((p) => p.id === pickedId) ? pickedId : null;

  const openProperty = (id: string) => router.push({ pathname: '/property/[id]', params: { id } });
  const quick: { id: QuickChipId; label: string }[] = [
    { id: 'budget', label: `Under ${formatBudgetRon(QUICK_BUDGET_RON)}` },
    { id: 'verified', label: 'Verified' },
    { id: 'furnished', label: 'Furnished' },
    { id: 'private_bath', label: 'Private bath' },
  ];
  const extraChips = useMemo(() => activeFilterChips(state, formatBudgetRon), [state, formatBudgetRon]);
  const summary = summarizeFilters(state);
  const isMap = state.view === 'map';
  const columns = layout.columns;
  const emptyState = current !== null && current.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { paddingHorizontal: layout.gutter, maxWidth: layout.contentMaxWidth }]}>
        <Text style={styles.title} accessibilityRole="header">Search</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={(v) => {
                  typed.current = true;
                  setText(v);
                }}
                onSubmitEditing={() => setState((prev) => ({ ...prev, text }))}
                placeholder="City, university or neighborhood"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search homes"
                style={styles.input}
              />
              {summary !== '' && <Text style={styles.summary} numberOfLines={1}>{summary}</Text>}
            </View>
            {text !== '' && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search text" hitSlop={8} onPress={() => setState((prev) => ({ ...prev, text: '' }))}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ''}`} onPress={() => router.push('/filters')} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={22} color="#fff" />
            {filterCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{filterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
          {quick.map((c) => (
            <Chip key={c.id} label={c.label} selected={isQuickChipActive(state, c.id)} onPress={() => setState((prev) => toggleQuickChip(prev, c.id))} />
          ))}
          {extraChips.map((c) => (
            <Chip key={c.id} label={c.label} onRemove={() => setState((prev) => removeFilter(prev, c.id))} />
          ))}
        </ScrollView>

        <View style={styles.resultsRow}>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {current ? (
              <>
                <Text style={styles.countBold}>{current.length}</Text>
                {describeResultCount(current.length, state).slice(String(current.length).length)}
              </>
            ) : (
              'Searching…'
            )}
          </Text>
          <SortMenu value={state.sort} onChange={(sort) => setState((prev) => ({ ...prev, sort }))} />
        </View>
      </View>
      <View style={styles.divider} />

      <View style={styles.body}>
        {shown === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : emptyState ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <EmptyResults hasFilters={filterCount > 0} onClear={() => setState((prev) => clearAll(prev))} />
          </ScrollView>
        ) : isMap ? (
          <PropertyMap
            properties={shown}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={openProperty}
            onPreviewHeightChange={setPreviewHeight}
            onShowList={() => setView('list')}
          />
        ) : (
          <FlatList
            key={columns}
            data={shown}
            numColumns={columns}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            columnWrapperStyle={columns > 1 ? { gap: layout.gap } : undefined}
            contentContainerStyle={{ width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: spacing.md, paddingBottom: 110 }}
            ListHeaderComponent={showsDemoData ? <View style={{ marginBottom: spacing.md }}><DemoNotice /></View> : null}
            renderItem={({ item }) => <PropertyCard property={item} width={columns > 1 ? layout.gridItemWidth : undefined} />}
          />
        )}
        {shown !== null && !emptyState && (
          <ViewToggle view={state.view} onChange={setView} bottom={isMap && selectedId && previewHeight > 0 ? previewHeight + spacing.md * 2 : spacing.lg} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { width: '100%', alignSelf: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  title: { fontSize: 26, color: colors.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6 },
  input: { fontSize: 15, fontWeight: '600', color: colors.text, padding: 0, minHeight: 22 },
  summary: { fontSize: 11, color: colors.muted },
  filterBtn: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#E6F25E', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  resultsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  count: { fontSize: 13, color: colors.muted },
  countBold: { fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
