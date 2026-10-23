import type { Currency, ExchangeRateSnapshot, Money } from './types';

// Conversion and rounding. Every function takes the exchange-rate snapshot explicitly, so nothing
// here knows where the rate comes from and everything is easy to test.

/** Whole-unit rounding used for anything shown to a student. Halves round up. */
export const roundUnits = (n: number): number => Math.round(n + Number.EPSILON);

/** Exact (unrounded) amount of `money` expressed in `to`. */
export function amountIn(money: Money, to: Currency, rate: ExchangeRateSnapshot): number {
  if (money.currency === to) return money.amount;
  return to === 'RON' ? money.amount * rate.eurToRon : money.amount / rate.eurToRon;
}

/** Exact (unrounded) conversion. The input is not modified. */
export function convertMoney(money: Money, to: Currency, rate: ExchangeRateSnapshot): Money {
  return { amount: amountIn(money, to, rate), currency: to };
}

/** The common unit used to compare and sort prices that are denominated in different currencies. */
export const toRon = (money: Money, rate: ExchangeRateSnapshot): number => amountIn(money, 'RON', rate);

export type DisplayPrice = {
  /** What the student sees: whole units in the display currency. */
  money: Money;
  /** True when the landlord's original currency differs from the display currency. */
  converted: boolean;
  /** The landlord's original price, untouched. */
  original: Money;
};

/** Original price -> display price. Rounds once, at the end, and never alters the original. */
export function toDisplayPrice(original: Money, display: Currency, rate: ExchangeRateSnapshot): DisplayPrice {
  const converted = original.currency !== display;
  const amount = converted ? roundUnits(amountIn(original, display, rate)) : roundUnits(original.amount);
  return { money: { amount, currency: display }, converted, original };
}

/** A RON-equivalent budget limit expressed in `currency`, rounded to whole units, for display and inputs. */
export const ronToDisplayAmount = (ron: number, currency: Currency, rate: ExchangeRateSnapshot): number =>
  roundUnits(amountIn({ amount: ron, currency: 'RON' }, currency, rate));

/** A budget limit typed in `currency` -> the RON-equivalent used for filtering (exact, unrounded). */
export const displayAmountToRon = (amount: number, currency: Currency, rate: ExchangeRateSnapshot): number =>
  toRon({ amount, currency }, rate);
