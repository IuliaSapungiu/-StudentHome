import type { Currency, ExchangeRateSnapshot, Money } from './types';

// Romanian-style formatting without relying on Intl support in the JS engine:
// dot as thousands separator, symbol AFTER the number, a non-breaking space in between
// (so a price never wraps onto two lines), whole units only.

const NBSP = '\u00a0';

export const CURRENCY_SYMBOL: Record<Currency, string> = { RON: 'lei', EUR: '€' };

export const CURRENCY_LABEL: Record<Currency, string> = { RON: 'RON', EUR: 'EUR' };

/** 2250 -> "2.250". Rounds to whole units. */
export function formatAmount(amount: number): string {
  const rounded = Math.round(Math.abs(amount) + Number.EPSILON);
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return amount < 0 && rounded !== 0 ? `-${grouped}` : grouped;
}

/** { 2250, RON } -> "2.250 lei"; { 450, EUR } -> "450 €". `approx` prefixes "≈ " for converted prices. */
export function formatMoney(money: Money, opts: { approx?: boolean } = {}): string {
  return `${opts.approx ? `≈${NBSP}` : ''}${formatAmount(money.amount)}${NBSP}${CURRENCY_SYMBOL[money.currency]}`;
}

/** 5 -> "1 € = 5,00 lei" (Romanian decimal comma). */
export function formatRate(rate: ExchangeRateSnapshot): string {
  return `1${NBSP}€ = ${rate.eurToRon.toFixed(2).replace('.', ',')}${NBSP}lei`;
}
