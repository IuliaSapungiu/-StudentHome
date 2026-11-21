/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMockPropertyRepository } from '../../data/mockRepository';
import { DEMO_PROPERTIES } from '../../data/mockProperties';
import { matchesBathroomBand, matchesDistanceBand } from '../../data/filterBands';
import type { PropertyRecord } from '../../data/types';
import { searchStateFromParams, searchStateToParams } from './params';
import { stateFromPreset } from './presets';
import { presetCity, presetNearUniversity } from './presets';
import { activeFilterChips, activeFilterCount, clearAll, defaultSearchState, describeResultCount, normalizeSearchState, queryKey, removeFilter, resetFilters, toQuery, type SearchState } from './searchState';

// Several choices inside ONE filter (city, university, distance, bathrooms, like bedrooms and property type) are OR-ed;
// different filters are AND-ed. The data is the demo list with a few distances and bathroom counts changed so that
// every filter has something to tell apart (the demo homes are all within 15 minutes, nearly all with one bathroom).
const OVERRIDES: Record<string, { minutes?: number; bathrooms?: number }> = {
  'demo-3': { minutes: 25 }, // Cluj-Napoca, UBB
  'demo-9': { minutes: 30 }, // Iași, UAIC
  'demo-6': { minutes: 31 }, // Bucharest, Politehnica: outside both bands
  'demo-5': { bathrooms: 2 }, // Bucharest, ASE
};
const records: PropertyRecord[] = DEMO_PROPERTIES.map((p) => {
  const o = OVERRIDES[p.id];
  return o ? { ...p, bathrooms: o.bathrooms ?? p.bathrooms, nearestUniversity: { ...p.nearestUniversity, minutes: o.minutes ?? p.nearestUniversity.minutes } } : p;
});
const repo = createMockPropertyRepository(records);
const d = defaultSearchState();
const idsFor = async (s: Partial<SearchState>) => (await repo.search(toQuery({ ...d, ...s }))).map((p) => p.id).sort();
const byFilter = (pred: (p: PropertyRecord) => boolean) => records.filter(pred).map((p) => p.id).sort();

(async () => {
  assert.equal(records.length, 11);

  // ---- the band rules themselves (no overlap, so every choice adds homes)
  assert.deepEqual([5, 15, 16, 30, 31].map((m) => matchesDistanceBand(m, 'within_15')), [true, true, false, false, false]);
  assert.deepEqual([5, 15, 16, 30, 31].map((m) => matchesDistanceBand(m, 'within_30')), [false, false, true, true, false]);
  assert.deepEqual([0, 1, 2, 3].map((b) => matchesBathroomBand(b, 'one')), [false, true, false, false]);
  assert.deepEqual([0, 1, 2, 3].map((b) => matchesBathroomBand(b, 'two_plus')), [false, false, true, true]);

  // ---- multiple cities (OR)
  const one = await idsFor({ cities: ['Bucharest'] });
  const two = await idsFor({ cities: ['Iași'] });
  assert.deepEqual(one, byFilter((p) => p.city === 'Bucharest'));
  const both = await idsFor({ cities: ['Bucharest', 'Iași'] });
  assert.deepEqual(both, [...new Set([...one, ...two])].sort(), 'selecting another city adds to the first one');
  assert.ok(both.length > one.length && both.length > two.length);
  assert.deepEqual(await idsFor({ cities: ['iasi', 'BUCHAREST'] }), both, 'letter case and accents do not matter');
  assert.deepEqual(await idsFor({ cities: [] }), await idsFor({}), 'no city chosen = any city');

  // ---- multiple universities (OR)
  const ase = await idsFor({ universities: ['ASE'] });
  const upt = await idsFor({ universities: ['UPT'] });
  assert.deepEqual(await idsFor({ universities: ['ASE', 'UPT'] }), [...ase, ...upt].sort());
  assert.ok(ase.length > 0 && upt.length > 0);

  // ---- multiple distance bands (OR)
  const w15 = await idsFor({ distances: ['within_15'] });
  const w30 = await idsFor({ distances: ['within_30'] });
  assert.deepEqual(w15, byFilter((p) => p.nearestUniversity.minutes <= 15));
  assert.deepEqual(w30, ['demo-3', 'demo-9']);
  assert.deepEqual(await idsFor({ distances: ['within_15', 'within_30'] }), [...w15, ...w30].sort(), 'both bands together = up to 30 minutes');
  assert.ok(!(await idsFor({ distances: ['within_15', 'within_30'] })).includes('demo-6'), 'a home 31 minutes away matches neither band');

  // ---- multiple bathroom values (OR)
  assert.deepEqual(await idsFor({ bathrooms: ['one'] }), byFilter((p) => p.bathrooms === 1));
  assert.deepEqual(await idsFor({ bathrooms: ['two_plus'] }), byFilter((p) => p.bathrooms >= 2));
  assert.deepEqual(await idsFor({ bathrooms: ['one', 'two_plus'] }), byFilter(() => true), 'one OR two-plus covers every home');

  // ---- different filters are AND-ed, whatever the number of choices in each
  const combined: Partial<SearchState> = {
    cities: ['Bucharest', 'Cluj-Napoca'],
    universities: ['ASE', 'UBB', 'UPT'],
    distances: ['within_15', 'within_30'],
    bedrooms: [0, 2, 3],
    bathrooms: ['one', 'two_plus'],
    types: ['studio', 'apartment'],
  };
  const expected = byFilter(
    (p) =>
      ['Bucharest', 'Cluj-Napoca'].includes(p.city) &&
      ['ASE', 'UBB', 'UPT'].includes(p.nearestUniversity.name) &&
      p.nearestUniversity.minutes <= 30 &&
      [0, 2, 3].some((b) => (b >= 3 ? p.bedrooms >= 3 : p.bedrooms === b)) &&
      p.bathrooms >= 1 &&
      ['studio', 'apartment'].includes(p.type),
  );
  assert.deepEqual(await idsFor(combined), expected);
  assert.ok(expected.length > 0 && expected.length < records.length, 'the combination is neither everything nor nothing');
  // every added group can only narrow the result, never widen it
  let narrowed = await idsFor({});
  for (const step of [{ cities: combined.cities }, { universities: combined.universities }, { distances: combined.distances }, { bedrooms: combined.bedrooms }, { types: combined.types }] as Partial<SearchState>[]) {
    const next = await idsFor(Object.assign({}, ...[step]));
    assert.ok(next.length <= (await idsFor({})).length);
    narrowed = narrowed.filter((id) => next.includes(id));
  }
  assert.deepEqual(narrowed, await idsFor({ cities: combined.cities, universities: combined.universities, distances: combined.distances, bedrooms: combined.bedrooms, types: combined.types }), 'AND across groups equals the intersection of each group');
  // a city OR-ed with a university from ANOTHER city still needs both groups to match (AND between groups)
  assert.deepEqual(await idsFor({ cities: ['Iași'], universities: ['ASE'] }), [], 'Iași AND ASE matches nothing: no home is in both');
  // the count shown on "Show N homes" is the length of this same search
  assert.equal(describeResultCount(expected.length, { ...d, ...combined }).startsWith(`${expected.length} `), true);
  assert.equal((await repo.search(toQuery({ ...d, ...combined }))).length, expected.length);

  // ---- selecting does not deselect: toggling several values builds up the list (what the Filters chips do)
  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  let draft = d;
  draft = normalizeSearchState({ ...draft, cities: toggle(draft.cities, 'Iași') });
  draft = normalizeSearchState({ ...draft, cities: toggle(draft.cities, 'Bucharest') });
  draft = normalizeSearchState({ ...draft, universities: toggle(draft.universities, 'ASE') });
  draft = normalizeSearchState({ ...draft, universities: toggle(draft.universities, 'UAIC') });
  draft = normalizeSearchState({ ...draft, distances: toggle(draft.distances, 'within_15') });
  draft = normalizeSearchState({ ...draft, distances: toggle(draft.distances, 'within_30') });
  draft = normalizeSearchState({ ...draft, bathrooms: toggle(draft.bathrooms, 'one') });
  draft = normalizeSearchState({ ...draft, bathrooms: toggle(draft.bathrooms, 'two_plus') });
  assert.deepEqual(draft.cities, ['Bucharest', 'Iași']);
  assert.deepEqual(draft.universities, ['ASE', 'UAIC']);
  assert.deepEqual(draft.distances, ['within_15', 'within_30']);
  assert.deepEqual(draft.bathrooms, ['one', 'two_plus']);
  assert.equal(activeFilterCount(draft), 4, 'each group counts once, however many choices it has');
  draft = normalizeSearchState({ ...draft, cities: toggle(draft.cities, 'Iași') });
  assert.deepEqual(draft.cities, ['Bucharest'], 'tapping a selected value removes only that value');
  assert.equal(queryKey(normalizeSearchState({ ...d, cities: ['Iași', 'Bucharest'] })), queryKey(normalizeSearchState({ ...d, cities: ['Bucharest', 'Iași'] })), 'the order of choosing does not change the search');

  // ---- "Applying" keeps every selected value (state -> query -> state, and via the URL)
  const applied = normalizeSearchState({ ...d, ...combined, text: 'x' });
  assert.deepEqual(applied.cities, ['Bucharest', 'Cluj-Napoca']);
  assert.deepEqual(applied.universities, ['ASE', 'UBB', 'UPT']);
  assert.deepEqual(applied.distances, ['within_15', 'within_30']);
  assert.deepEqual(applied.bathrooms, ['one', 'two_plus']);
  assert.deepEqual(searchStateFromParams(searchStateToParams(applied)), applied, 'all selections survive a round trip through the URL');
  assert.deepEqual(searchStateToParams(applied).city, 'Bucharest,Cluj-Napoca');
  // older single-value links keep working
  assert.deepEqual(searchStateFromParams({ city: 'Cluj-Napoca', uni: 'UBB', maxMin: '30', baths: '2+' }).distances, ['within_15', 'within_30']);
  assert.deepEqual(searchStateFromParams({ baths: '1,2+' }).bathrooms, ['one', 'two_plus']);
  assert.deepEqual(searchStateFromParams({ city: 'Iași,Bucharest' }).cities, ['Bucharest', 'Iași']);

  // ---- chips and clearing
  const chips = activeFilterChips(applied, (n) => `${n} lei`);
  assert.equal(chips.find((c) => c.id === 'city')?.label, 'Bucharest, Cluj-Napoca');
  assert.equal(chips.find((c) => c.id === 'university')?.label, 'Near ASE, UBB, UPT');
  assert.equal(chips.find((c) => c.id === 'distance')?.label, 'Up to 15 min, 16–30 min');
  assert.equal(chips.find((c) => c.id === 'bathrooms')?.label, '1, 2+ bathrooms');
  assert.equal(describeResultCount(3, applied), '3 homes near ASE, UBB, UPT');
  assert.equal(describeResultCount(3, { ...d, cities: ['Bucharest', 'Iași'] }), '3 homes in Bucharest, Iași');
  for (const id of ['city', 'university', 'distance', 'bathrooms']) {
    const cleared = removeFilter(applied, id);
    assert.equal(activeFilterCount(cleared), activeFilterCount(applied) - 1, `removing the ${id} chip clears the whole group`);
    assert.deepEqual(cleared.bedrooms, applied.bedrooms, 'other groups keep their choices');
  }
  const reset = resetFilters(applied);
  assert.deepEqual([reset.cities, reset.universities, reset.distances, reset.bathrooms], [[], [], [], []], 'Reset clears the four lists');
  assert.equal(activeFilterCount(reset), 0);
  assert.equal(reset.text, 'x', 'Reset keeps the typed text');
  assert.deepEqual(clearAll(applied).cities, []);
  assert.deepEqual(await idsFor(reset), await idsFor({ text: 'x' }), 'after Reset only the typed text still narrows the search');
  assert.deepEqual(await idsFor(resetFilters({ ...applied, text: '' })), await idsFor({}), 'with no text, every home is back');
  // clear, then apply again: the same result as the first time
  const reapplied = normalizeSearchState({ ...reset, ...combined });
  assert.deepEqual(await idsFor({ ...reapplied, text: '' }), expected);
  assert.equal(queryKey({ ...reapplied, text: '' }), queryKey(normalizeSearchState({ ...d, ...combined })));

  // ---- Home presets still start a fresh single-choice search
  assert.deepEqual(stateFromPreset(presetCity('Iași')).cities, ['Iași']);
  assert.deepEqual(stateFromPreset(presetNearUniversity('ASE')).universities, ['ASE']);
  assert.deepEqual(await idsFor(stateFromPreset(presetCity('Iași'))), two);

  console.log('multiSelect: all checks passed');
})();
