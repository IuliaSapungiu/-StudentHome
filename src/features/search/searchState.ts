import { BATHROOM_BANDS, BATHROOM_BAND_LABEL, DISTANCE_BANDS, DISTANCE_BAND_LABEL, type BathroomBand, type DistanceBand } from '../../data/filterBands';
import type { Amenity, PropertySearchQuery, PropertyType, SortOption } from '../../data/types';
import { formatIsoDate, isValidIsoDate } from '../../lib/dates';
import { EMPTY_BUDGET, hasBudget, normalizeBudget, type Budget } from './budget';

// Everything the student has chosen on Search / Filters, plus the pure rules around it.
// This module is pure: no React, React Native, Expo or storage imports.

export type SearchView = 'list' | 'map';
/** A bathroom choice. "Any" is not a choice: no choice selected means no bathroom filter. */
export type BathroomChoice = BathroomBand;
export type DistanceChoice = DistanceBand;

export const PROPERTY_TYPES: readonly PropertyType[] = ['studio', 'apartment', 'private_room', 'shared_room', 'residence'];
export const AMENITIES: readonly Amenity[] = ['furnished', 'bills_included', 'private_bathroom', 'wifi', 'washing_machine', 'parking'];
export const SORT_OPTIONS: readonly SortOption[] = ['recommended', 'price_asc', 'price_desc'];
export const BATHROOM_CHOICES: readonly BathroomChoice[] = BATHROOM_BANDS;
export const BATHROOM_LABEL = BATHROOM_BAND_LABEL;
/** Distance filter choices (non-overlapping bands of minutes to the university; see data/filterBands.ts). */
export const DISTANCE_CHOICES: readonly DistanceChoice[] = DISTANCE_BANDS;
export const DISTANCE_LABEL = DISTANCE_BAND_LABEL;
/** 0 = studio, 3 = "3 or more". */
export const BEDROOM_CHOICES: readonly number[] = [0, 1, 2, 3];

export type SearchState = {
  text: string;
  /** Several cities can be chosen; a home in any of them matches. Empty = any city. */
  cities: string[];
  /** University short names, for example ["ASE"]. Several can be chosen (OR). Empty = any university. */
  universities: string[];
  /** RON-equivalent limits; see budget.ts. */
  budget: Budget;
  /** Several distance bands can be chosen (OR). Empty = any distance. */
  distances: DistanceChoice[];
  bedrooms: number[];
  /** Several bathroom choices can be chosen (OR). Empty = any number of bathrooms. */
  bathrooms: BathroomChoice[];
  types: PropertyType[];
  /** ISO date (YYYY-MM-DD): show homes available on or before this day. */
  availableBy: string | null;
  amenities: Amenity[];
  /** Landlord identity verification only. It says nothing about the property itself. */
  verifiedOnly: boolean;
  sort: SortOption;
  view: SearchView;
};

export const defaultSearchState = (): SearchState => ({
  text: '',
  cities: [],
  universities: [],
  budget: { ...EMPTY_BUDGET },
  distances: [],
  bedrooms: [],
  bathrooms: [],
  types: [],
  availableBy: null,
  amenities: [],
  verifiedOnly: false,
  sort: 'recommended',
  view: 'list',
});

const uniq = <T,>(list: readonly T[]): T[] => [...new Set(list)];
/** Trimmed, non-empty, de-duplicated (ignoring letter case) and sorted, so the same choices always give the same state and the same query key. */
const cleanStrings = (v: unknown): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    if (typeof x !== 'string' || x.trim() === '') continue;
    const t = x.trim();
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};
/** Keeps only known choices, once each, in the canonical order. */
const onlyKnown = <T extends string>(known: readonly T[], v: unknown): T[] => known.filter((k) => Array.isArray(v) && v.includes(k));

/** Makes any partial / untrusted state safe: unknown values are dropped, lists de-duplicated, ranges ordered. */
export function normalizeSearchState(input: Partial<SearchState> | null | undefined): SearchState {
  const base = defaultSearchState();
  const s = input ?? {};
  return {
    text: typeof s.text === 'string' ? s.text.slice(0, 100) : base.text,
    cities: cleanStrings(s.cities),
    universities: cleanStrings(s.universities),
    budget: normalizeBudget(s.budget),
    distances: onlyKnown(DISTANCE_CHOICES, s.distances),
    bedrooms: uniq((Array.isArray(s.bedrooms) ? s.bedrooms : []).filter((n) => BEDROOM_CHOICES.includes(n))).sort((a, b) => a - b),
    bathrooms: onlyKnown(BATHROOM_CHOICES, s.bathrooms),
    types: uniq((Array.isArray(s.types) ? s.types : []).filter((t) => PROPERTY_TYPES.includes(t))),
    availableBy: isValidIsoDate(s.availableBy) ? s.availableBy : null,
    amenities: uniq((Array.isArray(s.amenities) ? s.amenities : []).filter((a) => AMENITIES.includes(a))),
    verifiedOnly: s.verifiedOnly === true,
    sort: SORT_OPTIONS.includes(s.sort as SortOption) ? (s.sort as SortOption) : 'recommended',
    view: s.view === 'map' ? 'map' : 'list',
  };
}

/** State -> repository query. Empty values are omitted. The repository does the actual filtering. */
export function toQuery(state: SearchState): PropertySearchQuery {
  const s = normalizeSearchState(state);
  const q: PropertySearchQuery = { sort: s.sort };
  const text = s.text.trim();
  if (text) q.text = text;
  if (s.cities.length) q.cities = s.cities;
  if (s.universities.length) q.universities = s.universities;
  if (s.budget.minRon !== null) q.minRentRon = s.budget.minRon;
  if (s.budget.maxRon !== null) q.maxRentRon = s.budget.maxRon;
  if (s.distances.length) q.distances = s.distances;
  if (s.bedrooms.length) q.bedrooms = s.bedrooms;
  if (s.bathrooms.length) q.bathrooms = s.bathrooms;
  if (s.types.length) q.types = s.types;
  if (s.availableBy) q.availableBy = s.availableBy;
  if (s.amenities.length) q.amenities = s.amenities;
  if (s.verifiedOnly) q.verifiedOnly = true;
  return q;
}

/** A stable string for "is this the same search?", used to avoid needless reloads. */
export const queryKey = (state: SearchState): string => JSON.stringify(toQuery(state));

/**
 * How many filters are on. Each separately-controlled filter counts once, however many choices it has: cities, universities, budget
 * (min and max together), distance, bedrooms, bathrooms, move-in date, property type, verified
 * landlords, and each ticked amenity. Text and sort are not filters.
 */
export function activeFilterCount(state: SearchState): number {
  const s = normalizeSearchState(state);
  return (
    (s.cities.length ? 1 : 0) +
    (s.universities.length ? 1 : 0) +
    (hasBudget(s.budget) ? 1 : 0) +
    (s.distances.length ? 1 : 0) +
    (s.bedrooms.length ? 1 : 0) +
    (s.bathrooms.length ? 1 : 0) +
    (s.types.length ? 1 : 0) +
    (s.availableBy ? 1 : 0) +
    (s.verifiedOnly ? 1 : 0) +
    s.amenities.length
  );
}

/** Reset on the Filters screen: clears every filter, keeps the typed text, sort and view. */
export function resetFilters(state: SearchState): SearchState {
  return { ...defaultSearchState(), text: state.text, sort: state.sort, view: state.view };
}

/** "Clear all" on the empty-results state: clears text and filters, keeps sort and view. */
export function clearAll(state: SearchState): SearchState {
  return { ...defaultSearchState(), sort: state.sort, view: state.view };
}

// ----- Quick chips (the row under the search field) --------------------------------------------

export type QuickChipId = 'budget' | 'verified' | 'furnished' | 'private_bath';

export const QUICK_CHIP_IDS: readonly QuickChipId[] = ['budget', 'verified', 'furnished', 'private_bath'];

/** The "Under 2.500 lei" chip sets this RON-equivalent maximum. */
export const QUICK_BUDGET_RON = 2500;

export function isQuickChipActive(state: SearchState, id: QuickChipId): boolean {
  switch (id) {
    case 'budget':
      return state.budget.maxRon === QUICK_BUDGET_RON && state.budget.minRon === null;
    case 'verified':
      return state.verifiedOnly;
    case 'furnished':
      return state.amenities.includes('furnished');
    case 'private_bath':
      return state.amenities.includes('private_bathroom');
  }
}

const toggleAmenity = (list: Amenity[], a: Amenity): Amenity[] => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]);

export function toggleQuickChip(state: SearchState, id: QuickChipId): SearchState {
  const on = isQuickChipActive(state, id);
  switch (id) {
    case 'budget':
      return { ...state, budget: on ? { ...state.budget, maxRon: null } : { minRon: null, maxRon: QUICK_BUDGET_RON } };
    case 'verified':
      return { ...state, verifiedOnly: !on };
    case 'furnished':
      return { ...state, amenities: toggleAmenity(state.amenities, 'furnished') };
    case 'private_bath':
      return { ...state, amenities: toggleAmenity(state.amenities, 'private_bathroom') };
  }
}

// ----- Active-filter chips and summaries --------------------------------------------------------

export type ActiveFilterChip = { id: string; label: string };

const TYPE_LABEL: Record<PropertyType, string> = {
  studio: 'Studio',
  apartment: 'Apartment',
  private_room: 'Private room',
  shared_room: 'Shared room',
  residence: 'Residence',
};
const AMENITY_LABEL: Record<Amenity, string> = {
  furnished: 'Furnished',
  bills_included: 'Bills included',
  private_bathroom: 'Private bathroom',
  wifi: 'Wi-Fi',
  washing_machine: 'Washing machine',
  parking: 'Parking',
};
const bedroomLabel = (n: number) => (n === 0 ? 'Studio' : n >= 3 ? '3+ bedrooms' : n === 1 ? '1 bedroom' : `${n} bedrooms`);

/**
 * Removable chips for the active filters that the quick chips do NOT already show.
 * `formatBudgetRon` turns a RON-equivalent amount into text in the current display currency.
 */
export function activeFilterChips(state: SearchState, formatBudgetRon: (ron: number) => string): ActiveFilterChip[] {
  const s = normalizeSearchState(state);
  const chips: ActiveFilterChip[] = [];
  if (s.cities.length) chips.push({ id: 'city', label: s.cities.join(', ') });
  if (s.universities.length) chips.push({ id: 'university', label: `Near ${s.universities.join(', ')}` });
  if (hasBudget(s.budget) && !isQuickChipActive(s, 'budget')) {
    const { minRon, maxRon } = s.budget;
    const label =
      minRon !== null && maxRon !== null
        ? `${formatBudgetRon(minRon)} – ${formatBudgetRon(maxRon)}`
        : maxRon !== null
          ? `Under ${formatBudgetRon(maxRon)}`
          : `From ${formatBudgetRon(minRon as number)}`;
    chips.push({ id: 'budget', label });
  }
  if (s.distances.length) chips.push({ id: 'distance', label: s.distances.map((d) => DISTANCE_LABEL[d]).join(', ') });
  if (s.bedrooms.length) chips.push({ id: 'bedrooms', label: s.bedrooms.map(bedroomLabel).join(', ') });
  if (s.bathrooms.length) chips.push({ id: 'bathrooms', label: `${s.bathrooms.map((b) => BATHROOM_LABEL[b]).join(', ')} ${s.bathrooms.length === 1 && s.bathrooms[0] === 'one' ? 'bathroom' : 'bathrooms'}` });
  if (s.types.length) chips.push({ id: 'types', label: s.types.map((t) => TYPE_LABEL[t]).join(', ') });
  if (s.availableBy) chips.push({ id: 'availableBy', label: `Move-in ${formatIsoDate(s.availableBy)}` });
  for (const a of s.amenities) {
    if (a === 'furnished' || a === 'private_bathroom') continue; // shown by quick chips
    chips.push({ id: `amenity:${a}`, label: AMENITY_LABEL[a] });
  }
  return chips;
}

/** Clears the filter behind a chip. Unknown ids leave the state unchanged. */
export function removeFilter(state: SearchState, id: string): SearchState {
  if (id === 'city') return { ...state, cities: [] };
  if (id === 'university') return { ...state, universities: [] };
  if (id === 'budget') return { ...state, budget: { ...EMPTY_BUDGET } };
  if (id === 'distance') return { ...state, distances: [] };
  if (id === 'bedrooms') return { ...state, bedrooms: [] };
  if (id === 'bathrooms') return { ...state, bathrooms: [] };
  if (id === 'types') return { ...state, types: [] };
  if (id === 'availableBy') return { ...state, availableBy: null };
  if (id.startsWith('amenity:')) return { ...state, amenities: state.amenities.filter((a) => a !== id.slice('amenity:'.length)) };
  return state;
}

/** The small caption under the search text, e.g. "Near ASE · Move-in 1 Nov 2026 · 3 filters". */
export function summarizeFilters(state: SearchState): string {
  const s = normalizeSearchState(state);
  const parts: string[] = [];
  if (s.universities.length) parts.push(`Near ${s.universities.join(', ')}`);
  else if (s.cities.length) parts.push(s.cities.join(', '));
  if (s.availableBy) parts.push(`Move-in ${formatIsoDate(s.availableBy)}`);
  const count = activeFilterCount(s);
  const shown = (s.universities.length || s.cities.length ? 1 : 0) + (s.availableBy ? 1 : 0);
  if (count > shown) parts.push(`${count} ${count === 1 ? 'filter' : 'filters'}`);
  return parts.join(' · ');
}

/** "11 homes", "1 home near ASE", "4 homes in Bucharest". */
export function describeResultCount(count: number, state: SearchState): string {
  const base = `${count} ${count === 1 ? 'home' : 'homes'}`;
  if (state.universities.length) return `${base} near ${state.universities.join(', ')}`;
  if (state.cities.length) return `${base} in ${state.cities.join(', ')}`;
  return base;
}

export const SORT_LABEL: Record<SortOption, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};
