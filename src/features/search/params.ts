import type { Amenity, PropertyType, SortOption } from '../../data/types';
import { isValidIsoDate } from '../../lib/dates';
import {
  AMENITIES,
  BATHROOM_CHOICES,
  DISTANCE_CHOICES,
  PROPERTY_TYPES,
  SORT_OPTIONS,
  defaultSearchState,
  normalizeSearchState,
  type BathroomChoice,
  type DistanceChoice,
  type SearchState,
} from './searchState';

// Search <-> URL parameters (deep links such as /search?city=Cluj-Napoca&verified=1).
// City, university, distance, bedroom, bathroom and type parameters take comma-separated lists (?city=Iași,Cluj-Napoca).
// Parsing is forgiving: anything invalid is ignored rather than failing. Budget limits (min, max)
// are RON-equivalent amounts, like the state itself.

export type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined): string[] =>
  (first(v) ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const positive = (v: string | undefined): number | undefined => {
  if (v === undefined || !/^\d+(\.\d+)?$/.test(v.trim())) return undefined;
  const n = Number(v);
  return n > 0 ? n : undefined;
};

/** Only the values that were present AND valid. Everything else is left to the defaults. */
export function parseSearchParams(raw: RawParams): Partial<SearchState> {
  const out: Partial<SearchState> = {};
  const q = first(raw.q)?.trim();
  if (q) out.text = q.slice(0, 100);
  const cities = list(raw.city);
  if (cities.length) out.cities = cities;
  const unis = list(raw.uni);
  if (unis.length) out.universities = unis;

  const min = positive(first(raw.min));
  const max = positive(first(raw.max));
  if (min !== undefined || max !== undefined) out.budget = { minRon: min ?? null, maxRon: max ?? null };

  // `dist` is a list of bands. The older single `maxMin` link (15 or 30 minutes) still works: "up to N minutes" = every band up to N.
  const dist = list(raw.dist).filter((d): d is DistanceChoice => (DISTANCE_CHOICES as readonly string[]).includes(d));
  const legacyMax = Number(first(raw.maxMin));
  if (dist.length) out.distances = dist;
  else if (legacyMax === 15) out.distances = ['within_15'];
  else if (legacyMax === 30) out.distances = ['within_15', 'within_30'];

  const beds = list(raw.beds)
    .map(Number)
    .filter((n) => Number.isInteger(n));
  if (beds.length) out.bedrooms = beds;

  const baths: BathroomChoice[] = [];
  for (const b of list(raw.baths)) {
    if (b === 'one' || b === '1') baths.push('one');
    else if (b === 'two_plus' || b === '2+' || b === '2') baths.push('two_plus');
  }
  if (baths.length) out.bathrooms = baths.filter((b, i) => baths.indexOf(b) === i && BATHROOM_CHOICES.includes(b));

  const types = list(raw.types).filter((t): t is PropertyType => (PROPERTY_TYPES as readonly string[]).includes(t));
  if (types.length) out.types = types;

  const by = first(raw.by);
  if (isValidIsoDate(by)) out.availableBy = by;

  const amenities = list(raw.amenities).filter((a): a is Amenity => (AMENITIES as readonly string[]).includes(a));
  if (amenities.length) out.amenities = amenities;

  const verified = first(raw.verified);
  if (verified === '1' || verified === 'true') out.verifiedOnly = true;

  const sort = first(raw.sort);
  if ((SORT_OPTIONS as readonly string[]).includes(sort ?? '')) out.sort = sort as SortOption;

  if (first(raw.view) === 'map') out.view = 'map';
  return out;
}

/** Defaults overlaid with whatever parsed from the URL, always a fully valid state. */
export const searchStateFromParams = (raw: RawParams): SearchState =>
  normalizeSearchState({ ...defaultSearchState(), ...parseSearchParams(raw) });

/** State -> parameters, omitting defaults. `searchStateFromParams(searchStateToParams(s))` equals `s`. */
export function searchStateToParams(state: SearchState): Record<string, string> {
  const s = normalizeSearchState(state);
  const p: Record<string, string> = {};
  if (s.text.trim()) p.q = s.text.trim();
  if (s.cities.length) p.city = s.cities.join(',');
  if (s.universities.length) p.uni = s.universities.join(',');
  if (s.budget.minRon !== null) p.min = String(s.budget.minRon);
  if (s.budget.maxRon !== null) p.max = String(s.budget.maxRon);
  if (s.distances.length) p.dist = s.distances.join(',');
  if (s.bedrooms.length) p.beds = s.bedrooms.join(',');
  if (s.bathrooms.length) p.baths = s.bathrooms.join(',');
  if (s.types.length) p.types = s.types.join(',');
  if (s.availableBy) p.by = s.availableBy;
  if (s.amenities.length) p.amenities = s.amenities.join(',');
  if (s.verifiedOnly) p.verified = '1';
  if (s.sort !== 'recommended') p.sort = s.sort;
  if (s.view === 'map') p.view = 'map';
  return p;
}
