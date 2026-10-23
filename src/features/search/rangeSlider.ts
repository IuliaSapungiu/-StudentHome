import { displayAmountToRon } from '../currency/money';
import type { Currency, ExchangeRateSnapshot } from '../currency/types';
import { clampToDomain, type Budget, type BudgetDomain, type DisplayBudget } from './budget';

// Maths behind the two-thumb budget slider. Pure: the component only turns touch positions into
// fractions (0..1) and back. Values are in the DISPLAY currency.

export type Thumbs = { low: number; high: number };

/** Nearest allowed value (multiple of `step` from the domain minimum), kept inside the domain. */
export function snapToStep(value: number, d: BudgetDomain): number {
  const snapped = d.min + Math.round((value - d.min) / d.step) * d.step;
  return clampToDomain(snapped, d);
}

export function valueToFraction(value: number, d: BudgetDomain): number {
  if (d.max === d.min) return 0;
  return (clampToDomain(value, d) - d.min) / (d.max - d.min);
}

export function fractionToValue(fraction: number, d: BudgetDomain): number {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  return snapToStep(d.min + f * (d.max - d.min), d);
}

/** Thumb positions for the current budget: no minimum -> left end, no maximum -> right end. */
export function thumbsFromBudget(display: DisplayBudget, d: BudgetDomain): Thumbs {
  const low = display.min === null ? d.min : snapToStep(display.min, d);
  const high = display.max === null ? d.max : snapToStep(display.max, d);
  return low <= high ? { low, high } : { low: high, high: low };
}

/** Moves one thumb, never letting the thumbs cross (they stay at least one step apart). */
export function moveThumb(thumbs: Thumbs, which: 'low' | 'high', value: number, d: BudgetDomain): Thumbs {
  const v = snapToStep(value, d);
  if (which === 'low') {
    const maxLow = Math.max(d.min, thumbs.high - d.step);
    return { low: Math.min(v, maxLow), high: thumbs.high };
  }
  const minHigh = Math.min(d.max, thumbs.low + d.step);
  return { low: thumbs.low, high: Math.max(v, minHigh) };
}

/** Thumbs -> budget. A thumb resting at an end of the track means "no limit" on that side. */
export function budgetFromThumbs(thumbs: Thumbs, d: BudgetDomain, currency: Currency, rate: ExchangeRateSnapshot): Budget {
  return {
    minRon: thumbs.low <= d.min ? null : displayAmountToRon(thumbs.low, currency, rate),
    maxRon: thumbs.high >= d.max ? null : displayAmountToRon(thumbs.high, currency, rate),
  };
}
