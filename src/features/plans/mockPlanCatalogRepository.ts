import { PROVIDER_PLAN_RULES, RESIDENCE_BUSINESS_THRESHOLD } from './eligibility';
import type { PlanCatalogRepository } from './planCatalogRepository';
import { PLANS, PLAN_ORDER } from './plans';
import { PRICE_TABLE_RON } from './pricing';

// Wraps the existing static modules (no rewrite) behind the repository interface.
export const createMockPlanCatalogRepository = (): PlanCatalogRepository => ({
  getCatalog: async () => ({
    plans: PLAN_ORDER.map((id) => PLANS[id]),
    priceTable: PRICE_TABLE_RON,
    eligibilityRules: PROVIDER_PLAN_RULES,
    residenceThreshold: RESIDENCE_BUSINESS_THRESHOLD,
  }),
});
