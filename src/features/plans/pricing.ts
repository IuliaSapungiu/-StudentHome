import type { PlanId } from './types';

// Prototype prices in RON per 30 days, by number of listings. NOT final commercial prices.
// Only 1-4 listings are defined. Anything else is "contact us" - do not invent other prices.
export const PRICING_PERIOD_DAYS = 30;
export const PRICED_LISTING_COUNTS = [1, 2, 3, 4] as const;
type PricedCount = (typeof PRICED_LISTING_COUNTS)[number];

export const PRICE_TABLE_RON: Partial<Record<PlanId, Record<PricedCount, number>>> = {
  basic: { 1: 39, 2: 69, 3: 89, 4: 109 },
  premium: { 1: 79, 2: 139, 3: 189, 4: 229 },
  managed_booking: { 1: 99, 2: 169, 3: 229, 4: 279 },
  // business: intentionally absent (custom pricing)
};

export type PriceQuote =
  | { kind: 'fixed'; planId: PlanId; listings: PricedCount; amountRon: number; periodDays: number }
  | {
      kind: 'contact_us';
      planId: PlanId;
      reason: 'custom_pricing' | 'portfolio_size_not_priced' | 'invalid_listing_count';
    };

export function getPlanQuote(planId: PlanId, listings: number): PriceQuote {
  if (planId === 'business') return { kind: 'contact_us', planId, reason: 'custom_pricing' };
  if (!Number.isInteger(listings) || listings < 1) {
    return { kind: 'contact_us', planId, reason: 'invalid_listing_count' };
  }
  const table = PRICE_TABLE_RON[planId];
  const amount = table?.[listings as PricedCount];
  if (amount === undefined) {
    return { kind: 'contact_us', planId, reason: 'portfolio_size_not_priced' };
  }
  return { kind: 'fixed', planId, listings: listings as PricedCount, amountRon: amount, periodDays: PRICING_PERIOD_DAYS };
}
