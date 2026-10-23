import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { exchangeRateSource } from '@/config/currency';
import { formatMoney } from '../currency/format';
import { ronToDisplayAmount, toDisplayPrice, type DisplayPrice } from '../currency/money';
import { DEFAULT_DISPLAY_CURRENCY, type Currency, type ExchangeRateSnapshot, type Money } from '../currency/types';
import { stateFromPreset, type SearchPreset } from './presets';
import { defaultSearchState, normalizeSearchState, type SearchState, type SearchView } from './searchState';

// One shared source of truth for the student's search and display currency, so Home, Search,
// Filters, the map and Property Detail always agree. It lives in memory for the app session.

type SearchContextValue = {
  state: SearchState;
  /** Replaces the search. Always normalised, so invalid values can never get in. */
  setState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
  setView: (view: SearchView) => void;
  /** Starts a fresh search from a Home preset (replacing earlier filters). `focus` asks Search to focus its text field. */
  applyPreset: (preset: SearchPreset, opts?: { focus?: boolean }) => void;
  /** Incremented whenever Search should focus its text field. */
  focusNonce: number;

  /** Display currency for every price shown to a student. RON by default. */
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  /** The exchange-rate snapshot in use (a DEMO rate; see src/config/currency.ts). */
  rate: ExchangeRateSnapshot;
  /** Landlord's original price -> display price in the current currency (original untouched). */
  displayPrice: (original: Money) => DisplayPrice;
  /** Formats a landlord price for display; converted prices carry an "≈" unless `plain`. */
  formatPrice: (original: Money, opts?: { plain?: boolean }) => string;
  /** Formats a RON-equivalent budget limit in the current currency (for chips and labels). */
  formatBudgetRon: (ron: number) => string;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<SearchState>(defaultSearchState);
  const [currency, setCurrency] = useState<Currency>(DEFAULT_DISPLAY_CURRENCY);
  const [focusNonce, setFocusNonce] = useState(0);
  const rate = exchangeRateSource.getRate();

  const setState = useCallback((next: SearchState | ((prev: SearchState) => SearchState)) => {
    setStateRaw((prev) => normalizeSearchState(typeof next === 'function' ? next(prev) : next));
  }, []);
  const setView = useCallback((view: SearchView) => setStateRaw((prev) => ({ ...prev, view })), []);
  const applyPreset = useCallback((preset: SearchPreset, opts?: { focus?: boolean }) => {
    setStateRaw(stateFromPreset(preset));
    if (opts?.focus) setFocusNonce((n) => n + 1);
  }, []);

  const value = useMemo<SearchContextValue>(() => {
    const displayPrice = (original: Money) => toDisplayPrice(original, currency, rate);
    return {
      state,
      setState,
      setView,
      applyPreset,
      focusNonce,
      currency,
      setCurrency,
      rate,
      displayPrice,
      formatPrice: (original, opts) => {
        const p = displayPrice(original);
        return formatMoney(p.money, { approx: p.converted && !opts?.plain });
      },
      formatBudgetRon: (ron) => formatMoney({ amount: ronToDisplayAmount(ron, currency, rate), currency }),
    };
  }, [state, setState, setView, applyPreset, focusNonce, currency, rate]);

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used inside <SearchProvider>');
  return ctx;
}
