import { defaultSearchState, normalizeSearchState, QUICK_BUDGET_RON, type SearchState } from './searchState';

// Presets used by the entry points on Home. Each one is a set of filters to start a search from.
// Applying a preset replaces any previous filters, so tapping "Cluj-Napoca" never keeps old chips.

export type SearchPreset = Partial<SearchState>;

/** The Home screen's "Near ASE" example university. */
export const HOME_UNIVERSITY = 'ASE';

export const presetAll = (): SearchPreset => ({});
export const presetNearUniversity = (university: string): SearchPreset => ({ university });
export const presetUnderBudget = (maxRon: number = QUICK_BUDGET_RON): SearchPreset => ({ budget: { minRon: null, maxRon } });
export const presetCity = (city: string): SearchPreset => ({ city });

/** A fresh, valid search state for a preset (list view, recommended sort, nothing else set). */
export const stateFromPreset = (preset: SearchPreset = {}): SearchState => normalizeSearchState({ ...defaultSearchState(), ...preset });
