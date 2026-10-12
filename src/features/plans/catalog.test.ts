/// <reference types="node" />
import assert from 'node:assert/strict';
import { getPlanEligibility, PROVIDER_PLAN_RULES } from './eligibility';
import { createMockPlanCatalogRepository } from './mockPlanCatalogRepository';
import { eligibilityFromCatalog, quoteFromCatalog } from './planCatalogRepository';
import { getPlanQuote } from './pricing';
import type { PlanId, ProviderType } from './types';

(async () => {
  const catalog = await createMockPlanCatalogRepository().getCatalog();
  assert.deepEqual(catalog.plans.map((p) => p.id), ['basic', 'premium', 'managed_booking', 'business']);

  // The catalogue gives exactly the same answers as the original modules (no behaviour change)
  for (const plan of ['basic', 'premium', 'managed_booking', 'business'] as PlanId[]) {
    for (const n of [0, 1, 2, 3, 4, 5, 20]) assert.deepEqual(quoteFromCatalog(catalog, plan, n), getPlanQuote(plan, n), `${plan} x${n}`);
  }
  for (const type of ['private_landlord', 'property_manager', 'agency', 'student_residence'] as ProviderType[]) {
    for (const n of [1, 4, 5, 19, 20, 50]) {
      assert.deepEqual(eligibilityFromCatalog(catalog, type, { propertyCount: n, roomsOrBeds: 500 }), getPlanEligibility(type, { propertyCount: n, roomsOrBeds: 500 }));
    }
  }

  // It is data-driven: a different catalogue changes the outcome without touching code
  const custom = {
    ...catalog,
    priceTable: { ...catalog.priceTable, basic: { 1: 10, 2: 20, 3: 30, 4: 40 } as const },
    eligibilityRules: { ...PROVIDER_PLAN_RULES, private_landlord: { ...PROVIDER_PLAN_RULES.private_landlord, businessAvailableFrom: 10, businessRecommendedFrom: 10 } },
    residenceThreshold: { residencesOrLocations: null, roomsOrBeds: 200 },
  };
  assert.deepEqual(quoteFromCatalog(custom, 'basic', 2), { kind: 'fixed', planId: 'basic', listings: 2, amountRon: 20, periodDays: 30 });
  assert.equal(eligibilityFromCatalog(custom, 'private_landlord', { propertyCount: 10 }).recommendedPlanId, 'business');
  assert.equal(eligibilityFromCatalog(catalog, 'private_landlord', { propertyCount: 10 }).recommendedPlanId, null);
  assert.equal(eligibilityFromCatalog(custom, 'student_residence', { propertyCount: 1, roomsOrBeds: 250 }).recommendedPlanId, 'business');
  assert.equal(eligibilityFromCatalog(catalog, 'student_residence', { propertyCount: 1, roomsOrBeds: 250 }).recommendedPlanId, null); // threshold still unset by default

  console.log('catalog: all checks passed');
})();
