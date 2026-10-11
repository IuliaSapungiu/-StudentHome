/// <reference types="node" />
import assert from 'node:assert/strict';
import { getPlanEligibility, type ResidenceBusinessThreshold, PROVIDER_PLAN_RULES } from './eligibility';
import { getPlanQuote } from './pricing';
import { photoLimit, planIncludes } from './plans';
import type { PlanId, ProviderType } from './types';

const eligible = (t: ProviderType, n: number, rooms?: number) =>
  getPlanEligibility(t, { propertyCount: n, roomsOrBeds: rooms }).eligiblePlanIds;
const rec = (t: ProviderType, n: number, rooms?: number, th?: ResidenceBusinessThreshold) =>
  getPlanEligibility(t, { propertyCount: n, roomsOrBeds: rooms }, PROVIDER_PLAN_RULES, th).recommendedPlanId;
const P = (...ids: PlanId[]) => ids;

// Private landlord
assert.deepEqual(eligible('private_landlord', 1), P('basic', 'premium', 'managed_booking'));
assert.deepEqual(eligible('private_landlord', 4), P('basic', 'premium', 'managed_booking'));
assert.deepEqual(eligible('private_landlord', 5), P('premium', 'managed_booking'));
assert.deepEqual(eligible('private_landlord', 19), P('premium', 'managed_booking'));
assert.deepEqual(eligible('private_landlord', 20), P('premium', 'managed_booking', 'business'));
assert.equal(rec('private_landlord', 19), null);
assert.equal(rec('private_landlord', 20), 'business');

// Property manager and agency (identical rules)
for (const t of ['property_manager', 'agency'] as const) {
  assert.deepEqual(eligible(t, 1), P('premium', 'managed_booking'));
  assert.deepEqual(eligible(t, 19), P('premium', 'managed_booking'));
  assert.equal(rec(t, 19), null);
  assert.deepEqual(eligible(t, 20), P('premium', 'managed_booking', 'business'));
  assert.equal(rec(t, 20), 'business');
}

// Student residence: no Basic, Business always eligible, recommendation unset by default
assert.deepEqual(eligible('student_residence', 1, 400), P('premium', 'managed_booking', 'business'));
assert.equal(rec('student_residence', 1, 5000), null);
assert.equal(rec('student_residence', 50, 5000), null);
// Once a threshold is configured, either dimension can trigger it
assert.equal(rec('student_residence', 1, 300, { residencesOrLocations: null, roomsOrBeds: 300 }), 'business');
assert.equal(rec('student_residence', 1, 299, { residencesOrLocations: null, roomsOrBeds: 300 }), null);
assert.equal(rec('student_residence', 3, 10, { residencesOrLocations: 3, roomsOrBeds: null }), 'business');

// Recommendation never removes alternatives
assert.ok(eligible('agency', 30).includes('premium') && eligible('agency', 30).includes('managed_booking'));

// Pricing: only the defined table; everything else is "contact us"
assert.deepEqual(getPlanQuote('basic', 1), { kind: 'fixed', planId: 'basic', listings: 1, amountRon: 39, periodDays: 30 });
assert.equal((getPlanQuote('premium', 4) as { amountRon: number }).amountRon, 229);
assert.equal((getPlanQuote('managed_booking', 3) as { amountRon: number }).amountRon, 229);
assert.deepEqual(getPlanQuote('premium', 5), { kind: 'contact_us', planId: 'premium', reason: 'portfolio_size_not_priced' });
assert.deepEqual(getPlanQuote('business', 1), { kind: 'contact_us', planId: 'business', reason: 'custom_pricing' });
assert.equal(getPlanQuote('basic', 0).kind, 'contact_us');
assert.equal(getPlanQuote('basic', 2.5).kind, 'contact_us');

// Feature matrix spot checks
assert.equal(photoLimit('basic'), 6);
assert.equal(photoLimit('premium'), 15);
assert.equal(photoLimit('business'), Infinity);
assert.equal(planIncludes('basic', 'verifiedBadge'), false);
assert.equal(planIncludes('premium', 'verifiedBadge'), true);
assert.equal(planIncludes('premium', 'viewingCoordination'), false);
assert.equal(planIncludes('managed_booking', 'viewingCoordination'), true);
assert.equal(planIncludes('managed_booking', 'multipleProperties'), false); // paid add-on, not included
assert.equal(planIncludes('business', 'multipleProperties'), true);

console.log('plans: all checks passed');
