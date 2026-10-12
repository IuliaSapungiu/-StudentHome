import { getPlanEligibility, type PlanEligibility, type ProviderPlanRules, type ResidenceBusinessThreshold } from './eligibility';
import { getPlanQuote, type PriceQuote, type PriceTable } from './pricing';
import type { PlanDefinition, PlanId, Portfolio, ProviderType } from './types';

/** Everything the plan UI needs, as data. Mock now; Supabase tables (plans, prices, rules) later. */
export type PlanCatalog = {
  plans: PlanDefinition[];
  priceTable: PriceTable;
  eligibilityRules: Record<ProviderType, ProviderPlanRules>;
  residenceThreshold: ResidenceBusinessThreshold;
};

export interface PlanCatalogRepository {
  getCatalog(): Promise<PlanCatalog>;
}

// Pure helpers so screens and (later) backend code apply the same rules to whatever data source is used.
export const quoteFromCatalog = (c: PlanCatalog, planId: PlanId, listings: number): PriceQuote => getPlanQuote(planId, listings, c.priceTable);

export const eligibilityFromCatalog = (c: PlanCatalog, providerType: ProviderType, portfolio: Portfolio): PlanEligibility =>
  getPlanEligibility(providerType, portfolio, c.eligibilityRules, c.residenceThreshold);
