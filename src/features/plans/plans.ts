import type { FeatureKey, FeatureValue, PlanDefinition, PlanId } from './types';

// Source of truth: the official package feature matrix. Do not add features here
// unless they are added to the matrix first.
export const PLANS: Record<PlanId, PlanDefinition> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    features: {
      publicListing: true,
      photos: 6,
      video: false,
      higherRanking: false,
      basicAnalytics: true,
      advancedAnalytics: false,
      studentEnquiries: true,
      viewingCoordination: false,
      studentVerification: false,
      bookingCoordination: false,
      documentManagement: false,
      paymentBookingFlow: false,
      multipleProperties: 'paid_add_on',
      bulkManagement: false,
      staffAccounts: false,
      customPricing: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    features: {
      publicListing: true,
      photos: 15,
      video: true,
      higherRanking: true,
      basicAnalytics: true,
      advancedAnalytics: true,
      studentEnquiries: true,
      viewingCoordination: false,
      studentVerification: false,
      bookingCoordination: false,
      documentManagement: false,
      paymentBookingFlow: false,
      multipleProperties: 'paid_add_on',
      bulkManagement: false,
      staffAccounts: false,
      customPricing: false,
    },
  },
  managed_booking: {
    id: 'managed_booking',
    name: 'Managed Booking',
    features: {
      publicListing: true,
      photos: 15,
      video: true,
      higherRanking: true,
      basicAnalytics: true,
      advancedAnalytics: true,
      studentEnquiries: true,
      viewingCoordination: true,
      studentVerification: true,
      bookingCoordination: true,
      documentManagement: true,
      paymentBookingFlow: true,
      multipleProperties: 'paid_add_on',
      bulkManagement: false,
      staffAccounts: false,
      customPricing: false,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    features: {
      publicListing: true,
      photos: 'unlimited',
      video: true,
      higherRanking: true,
      basicAnalytics: true,
      advancedAnalytics: true,
      studentEnquiries: true,
      viewingCoordination: true,
      studentVerification: true,
      bookingCoordination: true,
      documentManagement: true,
      paymentBookingFlow: true,
      multipleProperties: true, // included
      bulkManagement: true,
      staffAccounts: true,
      customPricing: true,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ['basic', 'premium', 'managed_booking', 'business'];

export const getPlan = (id: PlanId) => PLANS[id];

export const getFeature = (id: PlanId, key: FeatureKey): FeatureValue => PLANS[id].features[key];

/** True when the feature is actually part of the plan ('paid_add_on' is not included). */
export function planIncludes(id: PlanId, key: FeatureKey): boolean {
  const value = getFeature(id, key);
  return value === true || value === 'unlimited' || (typeof value === 'number' && value > 0);
}

/** Maximum photos for the plan; Infinity when unlimited. */
export function photoLimit(id: PlanId): number {
  const value = getFeature(id, 'photos');
  return value === 'unlimited' ? Infinity : typeof value === 'number' ? value : 0;
}
