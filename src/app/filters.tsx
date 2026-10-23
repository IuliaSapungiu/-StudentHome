import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { propertyRepository, describeAmenity, describePropertyType, type Amenity, type CitySummary, type PropertyType } from '@/data';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { ContentContainer } from '@/components/ContentContainer';
import { ChipRow, FilterSection } from '@/components/filters/FilterSection';
import { CurrencySelector } from '@/components/filters/CurrencySelector';
import { RangeSlider } from '@/components/filters/RangeSlider';
import { Chip } from '@/components/search/Chip';
import { CURRENCY_SYMBOL, formatAmount, formatRate } from '@/features/currency/format';
import type { Currency } from '@/features/currency/types';
import { applyBudgetInput, budgetDomain, budgetToDisplay } from '@/features/search/budget';
import { budgetFromThumbs, thumbsFromBudget } from '@/features/search/rangeSlider';
import { useSearch } from '@/features/search/SearchProvider';
import {
  AMENITIES,
  BEDROOM_CHOICES,
  PROPERTY_TYPES,
  SORT_LABEL,
  SORT_OPTIONS,
  queryKey,
  resetFilters,
  toQuery,
  type BathroomChoice,
  type SearchState,
} from '@/features/search/searchState';
import { formatIsoDate, fromIsoDate, toIsoDate } from '@/lib/dates';

const BEDROOM_LABEL = (n: number) => (n === 0 ? 'Studio' : n >= 3 ? '3+' : String(n));
const BATH_CHOICES: { value: BathroomChoice; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'one', label: '1' },
  { value: 'two_plus', label: '2+' },
];
const toggleIn = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function FiltersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, setState, currency, setCurrency, rate } = useSearch();

  // Edits happen on a DRAFT; nothing changes the search until "Show N homes" is pressed.
  const [draft, setDraft] = useState<SearchState>(state);
  const [draftCurrency, setDraftCurrency] = useState<Currency>(currency);
  const patch = (p: Partial<SearchState>) => setDraft((d) => ({ ...d, ...p }));

  // ---- Budget: inputs + slider, shown in the display currency, stored as RON-equivalent ----
  const domain = budgetDomain(draftCurrency, rate);
  const display = budgetToDisplay(draft.budget, draftCurrency, rate);
  const shownMin = display.min === null ? '' : String(display.min);
  const shownMax = display.max === null ? '' : String(display.max);
  const [minText, setMinText] = useState(shownMin);
  const [maxText, setMaxText] = useState(shownMax);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  // When the budget changes from elsewhere (slider, currency switch, Reset) the inputs follow it.
  const [shownKey, setShownKey] = useState(`${shownMin}|${shownMax}|${draftCurrency}`);
  if (shownKey !== `${shownMin}|${shownMax}|${draftCurrency}`) {
    setShownKey(`${shownMin}|${shownMax}|${draftCurrency}`);
    setMinText(shownMin);
    setMaxText(shownMax);
  }

  const resolveBudget = () => {
    let budget = draft.budget;
    for (const [which, raw] of [['min', minText], ['max', maxText]] as const) {
      const r = applyBudgetInput(budget, which, raw, draftCurrency, rate);
      if (r.error) return { budget: draft.budget, error: r.error };
      budget = r.budget;
    }
    return { budget, error: null };
  };
  const commitBudgetText = () => {
    const r = resolveBudget();
    setBudgetError(r.error);
    if (r.error) {
      setMinText(shownMin);
      setMaxText(shownMax);
    } else patch({ budget: r.budget });
  };

  const thumbs = thumbsFromBudget(display, domain);
  const symbol = CURRENCY_SYMBOL[draftCurrency];

  // ---- Option lists (cities and universities come from the data, not hard-coded) ----
  const [cities, setCities] = useState<CitySummary[]>([]);
  const [universities, setUniversities] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all([propertyRepository.getCities(), propertyRepository.search({})]).then(([c, all]) => {
      if (!alive) return;
      setCities(c);
      setUniversities([...new Set(all.map((p) => p.nearestUniversity.name))].sort());
    });
    return () => {
      alive = false;
    };
  }, []);

  // ---- Live "Show N homes" count for the draft ----
  const [count, setCount] = useState<number | null>(null);
  const key = queryKey(draft);
  useEffect(() => {
    let alive = true;
    propertyRepository.search(toQuery(draft)).then((r) => alive && setCount(r.length));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const today = toIsoDate(new Date());

  const apply = () => {
    const r = resolveBudget();
    if (r.error) {
      setBudgetError(r.error);
      return;
    }
    setState({ ...draft, budget: r.budget });
    setCurrency(draftCurrency);
    router.navigate('/search');
  };

  const showLabel = count === null ? 'Show homes' : count === 1 ? 'Show 1 home' : `Show ${count} homes`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ContentContainer maxWidth={680} style={styles.header}>
        <BackButton />
        <Text style={styles.title} accessibilityRole="header">Filters</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset all filters" onPress={() => { setDraft((d) => resetFilters(d)); setBudgetError(null); }} hitSlop={8}>
          <Text style={styles.reset}>Reset</Text>
        </Pressable>
      </ContentContainer>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <ContentContainer maxWidth={680}>
          <FilterSection title="City">
            <ChipRow>
              <Chip label="Any city" selected={draft.city === null} onPress={() => patch({ city: null })} />
              {cities.map((c) => (
                <Chip key={c.name} label={c.name} selected={draft.city === c.name} onPress={() => patch({ city: c.name })} />
              ))}
            </ChipRow>
          </FilterSection>

          <FilterSection title="University">
            <ChipRow>
              <Chip label="Any university" selected={draft.university === null} onPress={() => patch({ university: null })} />
              {universities.map((u) => (
                <Chip key={u} label={u} selected={draft.university === u} onPress={() => patch({ university: u })} />
              ))}
            </ChipRow>
          </FilterSection>

          <FilterSection title="Monthly budget" note={budgetError ?? undefined}>
            <View style={styles.pills}>
              <View style={[styles.pill, budgetError && styles.pillError]}>
                <TextInput
                  value={minText}
                  onChangeText={setMinText}
                  onBlur={commitBudgetText}
                  onSubmitEditing={commitBudgetText}
                  placeholder={formatAmount(domain.min)}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={9}
                  accessibilityLabel={`Minimum monthly budget in ${draftCurrency}`}
                  style={styles.pillInput}
                />
                <Text style={styles.pillUnit}>{symbol}</Text>
              </View>
              <Text style={styles.dash}>–</Text>
              <View style={[styles.pill, budgetError && styles.pillError]}>
                <TextInput
                  value={maxText}
                  onChangeText={setMaxText}
                  onBlur={commitBudgetText}
                  onSubmitEditing={commitBudgetText}
                  placeholder={`${formatAmount(domain.max)}+`}
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={9}
                  accessibilityLabel={`Maximum monthly budget in ${draftCurrency}`}
                  style={styles.pillInput}
                />
                <Text style={styles.pillUnit}>{symbol}</Text>
              </View>
            </View>
            <RangeSlider
              domain={domain}
              low={thumbs.low}
              high={thumbs.high}
              onCommit={(t) => {
                setBudgetError(null);
                patch({ budget: budgetFromThumbs(t, domain, draftCurrency, rate) });
              }}
            />
            <View style={styles.ends}>
              <Text style={styles.endText}>{formatAmount(domain.min)} {symbol}</Text>
              <Text style={styles.endText}>{formatAmount(domain.max)}+ {symbol}</Text>
            </View>
          </FilterSection>

          <FilterSection
            title="Display currency"
            note={`Only changes how prices are shown. Prices are converted at a demo exchange rate of ${formatRate(rate)} (not a live rate), and your budget keeps matching the same homes.`}>
            <CurrencySelector value={draftCurrency} onChange={setDraftCurrency} />
          </FilterSection>

          <FilterSection title="Distance to university">
            <ChipRow>
              <Chip label="Any distance" selected={draft.maxMinutesToUniversity === null} onPress={() => patch({ maxMinutesToUniversity: null })} />
              <Chip label="Under 15 min" selected={draft.maxMinutesToUniversity === 15} onPress={() => patch({ maxMinutesToUniversity: 15 })} />
              <Chip label="Under 30 min" selected={draft.maxMinutesToUniversity === 30} onPress={() => patch({ maxMinutesToUniversity: 30 })} />
            </ChipRow>
          </FilterSection>

          <FilterSection title="Bedrooms">
            <ChipRow>
              {BEDROOM_CHOICES.map((n) => (
                <Chip key={n} label={BEDROOM_LABEL(n)} selected={draft.bedrooms.includes(n)} onPress={() => patch({ bedrooms: toggleIn(draft.bedrooms, n) })} />
              ))}
            </ChipRow>
          </FilterSection>

          <FilterSection title="Bathrooms">
            <ChipRow>
              {BATH_CHOICES.map((b) => (
                <Chip key={b.value} label={b.label} selected={draft.bathrooms === b.value} onPress={() => patch({ bathrooms: b.value })} />
              ))}
            </ChipRow>
          </FilterSection>

          <FilterSection title="Property type">
            <ChipRow>
              {PROPERTY_TYPES.map((t: PropertyType) => (
                <Chip key={t} label={describePropertyType(t)} selected={draft.types.includes(t)} onPress={() => patch({ types: toggleIn(draft.types, t) })} />
              ))}
            </ChipRow>
          </FilterSection>

          <FilterSection title="Move-in date">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={draft.availableBy ? `Move-in date ${formatIsoDate(draft.availableBy)}. Change` : 'Choose a move-in date'}
              onPress={() => setPickerOpen((v) => !v)}
              style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.text} />
              <Text style={styles.dateText}>{draft.availableBy ? formatIsoDate(draft.availableBy) : 'Any date'}</Text>
              <Ionicons name={pickerOpen ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.muted} />
            </Pressable>
            {draft.availableBy && !pickerOpen && (
              <Pressable accessibilityRole="button" onPress={() => patch({ availableBy: null })} hitSlop={8}>
                <Text style={styles.link}>Clear date</Text>
              </Pressable>
            )}
            {pickerOpen && (
              <View>
                <DateTimePicker
                  value={fromIsoDate(draft.availableBy ?? today)}
                  mode="date"
                  display="inline"
                  minimumDate={fromIsoDate(today)}
                  accentColor={colors.primary}
                  onValueChange={(_e, date) => {
                    patch({ availableBy: toIsoDate(date) });
                    if (Platform.OS === 'android') setPickerOpen(false);
                  }}
                  onDismiss={() => setPickerOpen(false)}
                />
                {Platform.OS !== 'android' && (
                  <Pressable accessibilityRole="button" onPress={() => setPickerOpen(false)} style={styles.doneBtn}>
                    <Text style={styles.link}>Done</Text>
                  </Pressable>
                )}
              </View>
            )}
            <Text style={styles.note}>Shows homes available on or before this date.</Text>
          </FilterSection>

          <FilterSection title="Features & amenities">
            <View style={{ gap: spacing.md }}>
              {AMENITIES.map((a: Amenity) => (
                <Checkbox key={a} checked={draft.amenities.includes(a)} onChange={() => patch({ amenities: toggleIn(draft.amenities, a) })}>
                  <Text style={styles.check}>{describeAmenity(a)}</Text>
                </Checkbox>
              ))}
              <Checkbox checked={draft.verifiedOnly} onChange={(v) => patch({ verifiedOnly: v })}>
                <Text style={styles.check}>Verified landlords</Text>
                <Text style={styles.note}>The landlord’s identity is verified. This does not mean the property itself has been checked.</Text>
              </Checkbox>
            </View>
          </FilterSection>

          <FilterSection title="Sort by">
            <ChipRow>
              {SORT_OPTIONS.map((o) => (
                <Chip key={o} label={SORT_LABEL[o]} selected={draft.sort === o} onPress={() => patch({ sort: o })} />
              ))}
            </ChipRow>
          </FilterSection>
        </ContentContainer>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <ContentContainer maxWidth={680}>
          <Button label={showLabel} onPress={apply} />
        </ContentContainer>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { flex: 1, fontSize: 22, color: colors.text },
  reset: { fontSize: 14, fontWeight: '700', color: colors.primary },
  pills: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: '#fff' },
  pillError: { borderColor: '#C0392B' },
  pillInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  pillUnit: { fontSize: 13, color: colors.muted, marginLeft: 6 },
  dash: { color: colors.muted },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  endText: { fontSize: 11, color: colors.muted },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  dateText: { flex: 1, fontSize: 14, color: colors.text },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: spacing.sm },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted },
  check: { fontSize: 14, color: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.md, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
});
