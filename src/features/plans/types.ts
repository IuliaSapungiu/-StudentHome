export type PlanId = 'basic' | 'premium' | 'managed_booking' | 'business';

export type ProviderType =
  | 'private_landlord'
  | 'property_manager'
  | 'agency'
  | 'student_residence';

export type FeatureKey =
  | 'publicListing'
  | 'photos'
  | 'video'
  | 'verifiedBadge'
  | 'higherRanking'
  | 'basicAnalytics'
  | 'advancedAnalytics'
  | 'studentEnquiries'
  | 'viewingCoordination'
  | 'studentVerification'
  | 'bookingCoordination'
  | 'documentManagement'
  | 'paymentBookingFlow'
  | 'multipleProperties'
  | 'bulkManagement'
  | 'staffAccounts'
  | 'customPricing';

// true = included, false = not included, number = a limit (photos),
// 'unlimited', or 'paid_add_on' (available for an extra fee that is NOT yet defined).
export type FeatureValue = boolean | number | 'unlimited' | 'paid_add_on';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  features: Record<FeatureKey, FeatureValue>;
};

/** What a provider tells us about their portfolio during onboarding. */
export type Portfolio = {
  /** Properties for landlords/managers/agencies; residences or locations for student residences. */
  propertyCount: number;
  /** Approximate rooms or beds. Used for student residences. */
  roomsOrBeds?: number;
};
