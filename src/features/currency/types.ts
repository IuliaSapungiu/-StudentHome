// Display and original-price currencies. Only RON and EUR are supported.
// This module is pure: no React, React Native, Expo, storage or '@/' imports.

export type Currency = 'RON' | 'EUR';

export const CURRENCIES: readonly Currency[] = ['RON', 'EUR'];

/** Students see prices in RON until they choose otherwise. */
export const DEFAULT_DISPLAY_CURRENCY: Currency = 'RON';

export const isCurrency = (value: unknown): value is Currency => value === 'RON' || value === 'EUR';

/**
 * An amount together with the currency it is denominated in. A landlord's ORIGINAL rent is stored
 * as a Money value and is never overwritten when a student changes the display currency: the
 * converted value is computed at read time (see money.ts) and is never stored.
 */
export type Money = { amount: number; currency: Currency };

/**
 * One exchange-rate reading. `eurToRon` is how many RON one EUR is worth.
 * `origin: 'demo'` marks a fixed demonstration rate that is NOT live, current or authoritative.
 */
export type ExchangeRateSnapshot = {
  eurToRon: number;
  /** ISO date (YYYY-MM-DD) the rate applies to. */
  effectiveDate: string;
  origin: 'demo' | 'provider';
};
