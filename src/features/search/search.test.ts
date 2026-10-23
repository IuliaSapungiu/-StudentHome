/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMockPropertyRepository } from '../../data/mockRepository';
import { DEMO_PROPERTIES } from '../../data/mockProperties';
import { createDemoExchangeRateSource, createStaticExchangeRateSource } from '../currency/exchangeRate';
import { toRon } from '../currency/money';
import { toMapPoints } from '../map/mapLogic';
import {
  EMPTY_BUDGET,
  RON_BUDGET_DOMAIN,
  applyBudgetInput,
  budgetDomain,
  budgetToDisplay,
  normalizeBudget,
  sameBudget,
} from './budget';
import { parseSearchParams, searchStateFromParams, searchStateToParams } from './params';
import { HOME_UNIVERSITY, presetAll, presetCity, presetNearUniversity, presetUnderBudget, stateFromPreset } from './presets';
import { budgetFromThumbs, fractionToValue, moveThumb, snapToStep, thumbsFromBudget, valueToFraction } from './rangeSlider';
import {
  QUICK_BUDGET_RON,
  activeFilterChips,
  activeFilterCount,
  clearAll,
  defaultSearchState,
  describeResultCount,
  isQuickChipActive,
  normalizeSearchState,
  queryKey,
  removeFilter,
  resetFilters,
  summarizeFilters,
  toQuery,
  toggleQuickChip,
  type SearchState,
} from './searchState';

const rate = createDemoExchangeRateSource().getRate();
const odd = createStaticExchangeRateSource({ eurToRon: 4.97, effectiveDate: '2026-10-01', origin: 'demo' }).getRate();
const fmt = (ron: number) => `${ron} lei`;

(async () => {
  // ---- Defaults and query construction ----
  const d = defaultSearchState();
  assert.deepEqual(toQuery(d), { sort: 'recommended' }, 'an untouched search sends no filters');
  assert.equal(activeFilterCount(d), 0);
  assert.equal(d.view, 'list');

  const full: SearchState = {
    ...d,
    text: '  ase  ',
    city: 'Bucharest',
    university: 'ASE',
    budget: { minRon: 1500, maxRon: 2500 },
    maxMinutesToUniversity: 15,
    bedrooms: [0, 1],
    bathrooms: 'one',
    types: ['studio', 'shared_room'],
    availableBy: '2026-11-15',
    amenities: ['furnished', 'wifi'],
    verifiedOnly: true,
    sort: 'price_asc',
  };
  assert.deepEqual(toQuery(full), {
    sort: 'price_asc',
    text: 'ase',
    city: 'Bucharest',
    university: 'ASE',
    minRentRon: 1500,
    maxRentRon: 2500,
    maxMinutesToUniversity: 15,
    bedrooms: [0, 1],
    minBathrooms: 1,
    maxBathrooms: 1,
    types: ['studio', 'shared_room'],
    availableBy: '2026-11-15',
    amenities: ['furnished', 'wifi'],
    verifiedOnly: true,
  });
  assert.deepEqual(toQuery({ ...d, bathrooms: 'two_plus' }), { sort: 'recommended', minBathrooms: 2 });
  assert.equal(queryKey(d), queryKey(defaultSearchState()));
  assert.notEqual(queryKey(d), queryKey({ ...d, verifiedOnly: true }));

  // ---- Validation / normalisation ----
  const dirty = normalizeSearchState({
    text: 'x'.repeat(300),
    city: '   ',
    budget: { minRon: 3000, maxRon: 1000 }, // reversed
    maxMinutesToUniversity: 99,
    bedrooms: [2, 2, 9, -1, 0],
    bathrooms: 'lots' as never,
    types: ['studio', 'castle' as never, 'studio'],
    availableBy: '2026-02-31',
    amenities: ['wifi', 'wifi', 'jacuzzi' as never],
    sort: 'cheapest' as never,
    view: 'sideways' as never,
  });
  assert.equal(dirty.text.length, 100);
  assert.equal(dirty.city, null);
  assert.deepEqual(dirty.budget, { minRon: 1000, maxRon: 3000 });
  assert.equal(dirty.maxMinutesToUniversity, null);
  assert.deepEqual(dirty.bedrooms, [0, 2]);
  assert.equal(dirty.bathrooms, 'any');
  assert.deepEqual(dirty.types, ['studio']);
  assert.equal(dirty.availableBy, null);
  assert.deepEqual(dirty.amenities, ['wifi']);
  assert.equal(dirty.sort, 'recommended');
  assert.equal(dirty.view, 'list');
  assert.deepEqual(normalizeSearchState(null), defaultSearchState());
  assert.deepEqual(normalizeBudget({ minRon: -5, maxRon: NaN }), EMPTY_BUDGET);
  assert.deepEqual(normalizeBudget({ minRon: 0, maxRon: 2000 }), { minRon: null, maxRon: 2000 });

  // ---- Active-filter counts, chips, removal ----
  assert.equal(activeFilterCount(full), 11); // city, uni, budget, distance, beds, baths, types, date, verified, 2 amenities
  assert.equal(activeFilterCount({ ...d, text: 'hello', sort: 'price_desc' }), 0, 'text and sort are not filters');
  assert.equal(activeFilterCount({ ...d, budget: { minRon: 1000, maxRon: 2000 } }), 1, 'min and max budget count once');
  const chips = activeFilterChips(full, fmt);
  assert.deepEqual(
    chips.map((c) => c.id),
    ['city', 'university', 'budget', 'distance', 'bedrooms', 'bathrooms', 'types', 'availableBy', 'amenity:wifi'],
    'furnished and verified are shown by the quick chips, not duplicated',
  );
  assert.equal(chips.find((c) => c.id === 'budget')?.label, '1500 lei – 2500 lei');
  assert.equal(chips.find((c) => c.id === 'availableBy')?.label, 'Move-in 15 Nov 2026');
  let peeled = full;
  for (const c of chips) peeled = removeFilter(peeled, c.id);
  assert.equal(removeFilter(peeled, 'nonsense'), peeled);
  assert.deepEqual(activeFilterChips(peeled, fmt), []);
  assert.equal(activeFilterCount(peeled), 2, 'only the quick-chip filters (verified, furnished) remain');
  assert.equal(resetFilters(full).text, '  ase  ', 'Reset keeps the typed text');
  assert.equal(resetFilters(full).sort, 'price_asc');
  assert.equal(activeFilterCount(resetFilters(full)), 0);
  assert.equal(clearAll(full).text, '');
  assert.equal(clearAll({ ...full, view: 'map' }).view, 'map');

  // ---- Quick chips ----
  let q = defaultSearchState();
  q = toggleQuickChip(q, 'budget');
  assert.deepEqual(q.budget, { minRon: null, maxRon: QUICK_BUDGET_RON });
  assert.ok(isQuickChipActive(q, 'budget'));
  q = toggleQuickChip(q, 'budget');
  assert.ok(!isQuickChipActive(q, 'budget') && q.budget.maxRon === null);
  assert.ok(isQuickChipActive(toggleQuickChip(q, 'furnished'), 'furnished'));
  assert.ok(isQuickChipActive(toggleQuickChip(q, 'private_bath'), 'private_bath'));
  assert.deepEqual(toggleQuickChip(toggleQuickChip(q, 'verified'), 'verified'), q);
  assert.ok(!isQuickChipActive({ ...q, budget: { minRon: 1500, maxRon: 2500 } }, 'budget'), 'a custom range is not the quick chip');

  // ---- Result wording and summaries ----
  assert.equal(describeResultCount(11, d), '11 homes');
  assert.equal(describeResultCount(1, d), '1 home');
  assert.equal(describeResultCount(4, { ...d, city: 'Bucharest' }), '4 homes in Bucharest');
  assert.equal(describeResultCount(2, { ...d, university: 'ASE', city: 'Bucharest' }), '2 homes near ASE');
  assert.equal(summarizeFilters(d), '');
  assert.equal(summarizeFilters({ ...d, university: 'ASE', availableBy: '2026-11-15' }), 'Near ASE · Move-in 15 Nov 2026');
  assert.equal(summarizeFilters({ ...d, city: 'Cluj-Napoca', verifiedOnly: true }), 'Cluj-Napoca · 2 filters');

  // ---- Home presets ----
  assert.deepEqual(stateFromPreset(presetAll()), defaultSearchState());
  assert.equal(stateFromPreset(presetNearUniversity(HOME_UNIVERSITY)).university, 'ASE');
  assert.deepEqual(stateFromPreset(presetUnderBudget()).budget, { minRon: null, maxRon: 2500 });
  assert.equal(stateFromPreset(presetCity('Cluj-Napoca')).city, 'Cluj-Napoca');
  assert.equal(activeFilterCount(stateFromPreset(presetCity('Iași'))), 1, 'a preset sets exactly its own filter');
  assert.ok(isQuickChipActive(stateFromPreset(presetUnderBudget(QUICK_BUDGET_RON)), 'budget'));

  // ---- Route parameter parsing ----
  assert.deepEqual(parseSearchParams({}), {});
  assert.deepEqual(parseSearchParams({ city: ['Iași', 'x'], q: ' ase ', uni: 'ASE', verified: '1', view: 'map' }), {
    text: 'ase',
    city: 'Iași',
    university: 'ASE',
    verifiedOnly: true,
    view: 'map',
  });
  assert.deepEqual(parseSearchParams({ min: '1500', max: '2500', maxMin: '15', beds: '0,2,x', baths: '2+', types: 'studio,castle', by: '2026-11-01', amenities: 'wifi,jacuzzi', sort: 'price_desc' }), {
    budget: { minRon: 1500, maxRon: 2500 },
    maxMinutesToUniversity: 15,
    bedrooms: [0, 2],
    bathrooms: 'two_plus',
    types: ['studio'],
    availableBy: '2026-11-01',
    amenities: ['wifi'],
    sort: 'price_desc',
  });
  // invalid values are ignored, never thrown
  assert.deepEqual(parseSearchParams({ min: '-5', max: 'abc', maxMin: '99', by: '2026-13-01', sort: 'cheapest', verified: 'no', view: 'sideways', baths: '7' }), {});
  assert.deepEqual(searchStateFromParams({ city: 'Cluj-Napoca' }).city, 'Cluj-Napoca');
  assert.deepEqual(searchStateFromParams({ nonsense: '1' }), defaultSearchState());
  // state -> params -> state round-trips
  assert.deepEqual(searchStateFromParams(searchStateToParams(full)), normalizeSearchState({ ...full, text: 'ase' }), 'text is trimmed in the URL');
  assert.deepEqual(searchStateToParams(d), {});

  // ---- Budget: typed input ----
  const none = EMPTY_BUDGET;
  assert.deepEqual(applyBudgetInput(none, 'max', '2.500', 'RON', rate).budget, { minRon: null, maxRon: 2500 });
  assert.deepEqual(applyBudgetInput(none, 'max', '2 500', 'RON', rate).budget, { minRon: null, maxRon: 2500 });
  assert.deepEqual(applyBudgetInput(none, 'max', '500', 'EUR', rate).budget, { minRon: null, maxRon: 2500 }, 'EUR input is stored as RON-equivalent');
  assert.deepEqual(applyBudgetInput({ minRon: 1000, maxRon: 2000 }, 'max', '', 'RON', rate).budget, { minRon: 1000, maxRon: null }, 'empty clears the limit');
  assert.deepEqual(applyBudgetInput({ minRon: 1000, maxRon: null }, 'min', '0', 'RON', rate).budget, EMPTY_BUDGET, 'minimum 0 means no minimum');
  for (const bad of ['abc', '12x', '-5', '2,5', '1e3']) {
    const r = applyBudgetInput({ minRon: null, maxRon: 2000 }, 'max', bad, 'RON', rate);
    assert.ok(r.error, `${bad} is rejected`);
    assert.deepEqual(r.budget, { minRon: null, maxRon: 2000 }, 'a rejected input changes nothing');
  }
  assert.ok(applyBudgetInput(none, 'max', '0', 'RON', rate).error, 'maximum 0 is rejected');
  assert.ok(applyBudgetInput(none, 'max', '99999999', 'RON', rate).error);
  assert.ok(applyBudgetInput({ minRon: null, maxRon: 2000 }, 'min', '2500', 'RON', rate).error, 'min above max is rejected');
  assert.ok(applyBudgetInput({ minRon: 2000, maxRon: null }, 'max', '1500', 'RON', rate).error, 'max below min is rejected');

  // ---- Budget: switching display currency never changes the intended budget ----
  const repo = createMockPropertyRepository();
  const repoOdd = createMockPropertyRepository(DEMO_PROPERTIES, undefined, undefined, { getRate: () => odd });
  const ids = async (r: typeof repo, budget: typeof none) => (await r.search(toQuery({ ...d, budget, sort: 'price_asc' }))).map((p) => p.id);
  for (const [r, rt] of [
    [repo, rate],
    [repoOdd, odd],
  ] as const) {
    for (const budget of [{ minRon: null, maxRon: 2500 }, { minRon: 1500, maxRon: 2500 }, { minRon: 1650, maxRon: 1650 }, { minRon: 2000, maxRon: null }]) {
      const before = await ids(r, budget);
      const eur = budgetToDisplay(budget, 'EUR', rt); // shown in EUR...
      const ron = budgetToDisplay(budget, 'RON', rt); // ...and shown in RON again
      // the stored budget is untouched by changing how it is displayed, so the matches cannot change
      assert.deepEqual(await ids(r, budget), before);
      assert.equal(ron.max, budget.maxRon);
      assert.ok(eur.min === null || Number.isInteger(eur.min));
    }
  }
  // typing the SAME budget in either currency selects the same homes (at a rate where it is exact)
  const inRon = applyBudgetInput(none, 'max', '2500', 'RON', rate).budget;
  const inEur = applyBudgetInput(none, 'max', '500', 'EUR', rate).budget;
  assert.ok(sameBudget(inRon, inEur));
  assert.deepEqual(await ids(repo, inRon), await ids(repo, inEur));
  // a listing priced in EUR is matched by an EUR budget equal to its own price, and by the RON equivalent
  const eurHome = (await repo.search()).find((p) => p.rent.currency === 'EUR')!;
  const exactEur = applyBudgetInput(none, 'max', String(eurHome.rent.amount), 'EUR', rate).budget;
  assert.ok((await ids(repo, exactEur)).includes(eurHome.id));
  assert.ok((await ids(repo, { minRon: null, maxRon: toRon(eurHome.rent, rate) })).includes(eurHome.id));
  assert.ok(!(await ids(repo, { minRon: null, maxRon: toRon(eurHome.rent, rate) - 1 })).includes(eurHome.id));
  // at an awkward rate, the EUR amount a student types for a listing's own price still includes it
  const typed = applyBudgetInput(none, 'max', String(eurHome.rent.amount), 'EUR', odd).budget;
  assert.ok((await ids(repoOdd, typed)).includes(eurHome.id));

  // ---- Budget domain per currency ----
  assert.deepEqual(budgetDomain('RON', rate), RON_BUDGET_DOMAIN);
  assert.deepEqual(budgetDomain('EUR', rate), { min: 200, max: 1000, step: 10 });
  assert.deepEqual(budgetDomain('EUR', odd), { min: 200, max: 1010, step: 10 });
  assert.ok(budgetDomain('EUR', createStaticExchangeRateSource({ eurToRon: 20, effectiveDate: 'x', origin: 'demo' }).getRate()).max > budgetDomain('EUR', rate).min);

  // ---- Slider maths ----
  const dom = RON_BUDGET_DOMAIN;
  assert.equal(snapToStep(1049, dom), 1000);
  assert.equal(snapToStep(1051, dom), 1100);
  assert.equal(snapToStep(-50, dom), 1000);
  assert.equal(snapToStep(99999, dom), 5000);
  assert.equal(valueToFraction(1000, dom), 0);
  assert.equal(valueToFraction(5000, dom), 1);
  assert.equal(valueToFraction(3000, dom), 0.5);
  assert.equal(valueToFraction(9999, dom), 1, 'out-of-range values clamp');
  assert.equal(fractionToValue(0.5, dom), 3000);
  assert.equal(fractionToValue(-1, dom), 1000);
  assert.equal(fractionToValue(2, dom), 5000);
  assert.equal(fractionToValue(NaN, dom), 1000);
  assert.deepEqual(thumbsFromBudget({ min: null, max: null }, dom), { low: 1000, high: 5000 });
  assert.deepEqual(thumbsFromBudget({ min: 1500, max: 2500 }, dom), { low: 1500, high: 2500 });
  assert.deepEqual(thumbsFromBudget({ min: 4000, max: 2000 }, dom), { low: 2000, high: 4000 }, 'reversed values are put in order');
  assert.deepEqual(thumbsFromBudget({ min: 100, max: 99999 }, dom), { low: 1000, high: 5000 });
  assert.deepEqual(moveThumb({ low: 1500, high: 2500 }, 'low', 3000, dom), { low: 2400, high: 2500 }, 'thumbs cannot cross');
  assert.deepEqual(moveThumb({ low: 1500, high: 2500 }, 'high', 1000, dom), { low: 1500, high: 1600 });
  assert.deepEqual(moveThumb({ low: 1500, high: 2500 }, 'high', 3730, dom), { low: 1500, high: 3700 });
  assert.deepEqual(budgetFromThumbs({ low: 1000, high: 5000 }, dom, 'RON', rate), EMPTY_BUDGET, 'resting at both ends means no limits');
  assert.deepEqual(budgetFromThumbs({ low: 1500, high: 2500 }, dom, 'RON', rate), { minRon: 1500, maxRon: 2500 });
  const eurDom = budgetDomain('EUR', rate);
  assert.deepEqual(budgetFromThumbs({ low: 300, high: 500 }, eurDom, 'EUR', rate), { minRon: 1500, maxRon: 2500 }, 'EUR thumbs are stored as RON-equivalent');
  assert.deepEqual(thumbsFromBudget(budgetToDisplay({ minRon: 1500, maxRon: 2500 }, 'EUR', rate), eurDom), { low: 300, high: 500 });

  // ---- List / Map consistency: one filtered array feeds both ----
  const states: SearchState[] = [
    d,
    { ...d, city: 'Bucharest' },
    { ...d, verifiedOnly: true, sort: 'price_desc' },
    { ...d, budget: { minRon: null, maxRon: 2500 }, types: ['studio', 'apartment'] },
    { ...d, text: 'timisoara', view: 'map' },
    { ...d, university: 'Politehnica', bathrooms: 'one' },
    { ...d, budget: { minRon: 99999, maxRon: null } }, // matches nothing
  ];
  for (const s of states) {
    const results = await repo.search(toQuery(s));
    const { points, missing } = toMapPoints(results);
    assert.equal(points.length + missing, results.length, 'every result is either on the map or counted as missing');
    assert.deepEqual(points.map((p) => p.id), results.filter((p) => p.approxLocation).map((p) => p.id), 'same listings, same order');
    assert.equal(describeResultCount(results.length, s).startsWith(String(results.length)), true, 'the count is the length of the same array');
  }
  // switching view (list <-> map) or display currency does not change the query, so results cannot change
  assert.equal(queryKey({ ...full, view: 'map' }), queryKey({ ...full, view: 'list' }));
  assert.deepEqual(await repo.search(toQuery(states[3])), await repo.search(toQuery({ ...states[3], view: 'map' })));
  // the verified filter follows landlord identity and nothing else
  const verified = await repo.search(toQuery({ ...d, verifiedOnly: true }));
  assert.ok(verified.length > 0 && verified.every((p) => p.landlordIdentityVerified));
  assert.ok(verified.some((p) => p.planId === 'basic'), 'a Basic-plan listing can be verified');
  assert.ok((await repo.search()).some((p) => p.planId === 'premium' && !p.landlordIdentityVerified), 'a Premium-plan listing can be unverified');

  console.log('search: all checks passed');
})();
