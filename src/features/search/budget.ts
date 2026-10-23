import { displayAmountToRon, ronToDisplayAmount, roundUnits } from '../currency/money';
import type { Currency, ExchangeRateSnapshot } from '../currency/types';

// Monthly-budget maths. Pure: no React, React Native or storage.
//
// The student's budget is stored as RON-EQUIVALENT limits (null = no limit). Whatever currency they
// are looking at, the stored limits are the same numbers, so switching the display currency can
// never change which properties match. Only the numbers SHOWN in the inputs and slider change.

export type Budget = { minRon: number | null; maxRon: number | null };

/** Budget limits as whole numbers in the display currency (what the inputs and slider show). */
export type DisplayBudget = { min: number | null; max: number | null };

export type BudgetDomain = { min: number; max: number; step: number };

export const EMPTY_BUDGET: Budget = { minRon: null, maxRon: null };

/** Slider range in RON. The top of the range means "this amount or more" (no upper limit). */
export const RON_BUDGET_DOMAIN: BudgetDomain = { min: 1000, max: 5000, step: 100 };

export const MAX_BUDGET_INPUT = 1_000_000;

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** The slider range in the display currency: the RON range converted and rounded to tidy EUR steps. */
export function budgetDomain(currency: Currency, rate: ExchangeRateSnapshot): BudgetDomain {
  if (currency === 'RON') return RON_BUDGET_DOMAIN;
  const step = 10;
  const min = Math.max(step, roundTo(RON_BUDGET_DOMAIN.min / rate.eurToRon, step));
  const max = Math.max(min + step, roundTo(RON_BUDGET_DOMAIN.max / rate.eurToRon, step));
  return { min, max, step };
}

export function budgetToDisplay(budget: Budget, currency: Currency, rate: ExchangeRateSnapshot): DisplayBudget {
  return {
    min: budget.minRon === null ? null : ronToDisplayAmount(budget.minRon, currency, rate),
    max: budget.maxRon === null ? null : ronToDisplayAmount(budget.maxRon, currency, rate),
  };
}

export const hasBudget = (b: Budget): boolean => b.minRon !== null || b.maxRon !== null;

export const sameBudget = (a: Budget, b: Budget): boolean => a.minRon === b.minRon && a.maxRon === b.maxRon;

/** Tidies a budget: drops unusable numbers and puts the limits in order (min <= max). */
export function normalizeBudget(b: { minRon?: unknown; maxRon?: unknown } | null | undefined): Budget {
  const clean = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_BUDGET_INPUT * 10 ? v : null);
  let min = clean(b?.minRon);
  let max = clean(b?.maxRon);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { minRon: min, maxRon: max };
}

export type BudgetInputResult = { budget: Budget; error?: string };

/**
 * Applies text typed into the minimum or maximum input. `raw` is in the DISPLAY currency.
 * Accepts "2500", "2.500" and "2 500". Empty clears the limit. Invalid input is rejected with a
 * message and the budget is returned unchanged, so a typo can never silently change the search.
 */
export function applyBudgetInput(
  budget: Budget,
  which: 'min' | 'max',
  raw: string,
  currency: Currency,
  rate: ExchangeRateSnapshot,
): BudgetInputResult {
  const text = raw.replace(/[\s\u00a0.]/g, '');
  const key = which === 'min' ? 'minRon' : 'maxRon';
  if (text === '') return { budget: { ...budget, [key]: null } };
  if (!/^\d+$/.test(text)) return { budget, error: 'Enter a whole number, for example 2500.' };
  const amount = Number(text);
  if (amount > MAX_BUDGET_INPUT) return { budget, error: 'That amount is too large.' };
  if (amount === 0) {
    if (which === 'min') return { budget: { ...budget, minRon: null } };
    return { budget, error: 'Maximum budget must be above 0.' };
  }
  const ron = displayAmountToRon(amount, currency, rate);
  const next = { ...budget, [key]: ron };
  if (next.minRon !== null && next.maxRon !== null && next.minRon > next.maxRon) {
    return { budget, error: which === 'min' ? "Minimum can't be higher than maximum." : "Maximum can't be lower than minimum." };
  }
  return { budget: next };
}

export const clampToDomain = (value: number, d: BudgetDomain): number => Math.min(d.max, Math.max(d.min, value));

export { roundUnits };
