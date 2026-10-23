import type { ExchangeRateSnapshot } from './types';

/**
 * The boundary between the app and wherever exchange rates come from.
 *
 * Today the only implementation is a fixed DEMO rate (see createDemoExchangeRateSource). It is
 * documented as a demonstration value: it is not live, not current and not authoritative.
 *
 * A real provider can replace it later without touching Search, Filters, Map or Property Detail,
 * because they only ever call `getRate()`. `getRate()` is deliberately synchronous: a real source
 * should refresh in the background (periodically), keep the LAST VALID snapshot and its effective
 * date in a cache, and keep returning that snapshot if a refresh fails, so a source failure can
 * never break pricing. None of that exists yet and no network request is made anywhere.
 */
export interface ExchangeRateSource {
  getRate(): ExchangeRateSnapshot;
}

/** Demonstration rate: 1 EUR = 5 RON. A round number on purpose; it is not a market rate. */
export const DEMO_EUR_TO_RON = 5;

/** Date the demo rate is labelled with. It does not mean the rate was valid on that day. */
export const DEMO_RATE_DATE = '2026-10-01';

/** Rates outside this range are treated as configuration mistakes, not as market movements. */
export const MIN_PLAUSIBLE_EUR_TO_RON = 1;
export const MAX_PLAUSIBLE_EUR_TO_RON = 20;

export function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_PLAUSIBLE_EUR_TO_RON && value <= MAX_PLAUSIBLE_EUR_TO_RON;
}

/** Reads a rate from a text setting (for example an environment variable). Undefined when unusable. */
export function parseRateSetting(raw: string | undefined | null): number | undefined {
  if (raw === undefined || raw === null || raw.trim() === '') return undefined;
  const n = Number(raw.trim().replace(',', '.'));
  return isValidRate(n) ? n : undefined;
}

/** A source that always returns the given snapshot. Useful for tests and for the demo source. */
export function createStaticExchangeRateSource(snapshot: ExchangeRateSnapshot): ExchangeRateSource {
  return { getRate: () => snapshot };
}

/** The Step 3b source. An unusable `eurToRon` falls back to the default demo rate. */
export function createDemoExchangeRateSource(eurToRon?: number): ExchangeRateSource {
  return createStaticExchangeRateSource({
    eurToRon: isValidRate(eurToRon) ? eurToRon : DEMO_EUR_TO_RON,
    effectiveDate: DEMO_RATE_DATE,
    origin: 'demo',
  });
}
