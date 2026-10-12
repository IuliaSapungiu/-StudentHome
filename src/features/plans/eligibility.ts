import { PLAN_ORDER } from './plans';
import type { PlanId, Portfolio, ProviderType } from './types';

// ---- Adjustable rules (the only place these numbers live) -------------------

export type ProviderPlanRules = {
  /** Basic is offered up to this many properties. null = Basic is never offered. */
  basicMaxProperties: number | null;
  /** Business is offered from this many properties (1 = always offered). */
  businessAvailableFrom: number;
  /** Business is recommended from this many properties. null = never by property count. */
  businessRecommendedFrom: number | null;
};

export const PROVIDER_PLAN_RULES: Record<ProviderType, ProviderPlanRules> = {
  private_landlord: { basicMaxProperties: 4, businessAvailableFrom: 20, businessRecommendedFrom: 20 },
  property_manager: { basicMaxProperties: null, businessAvailableFrom: 20, businessRecommendedFrom: 20 },
  agency: { basicMaxProperties: null, businessAvailableFrom: 20, businessRecommendedFrom: 20 },
  // Student residences: Business is always an option. The recommendation thresholds are
  // deliberately UNSET until they are defined. Set a number below to switch them on.
  student_residence: { basicMaxProperties: null, businessAvailableFrom: 1, businessRecommendedFrom: null },
};

export type ResidenceBusinessThreshold = {
  /** Recommend Business from this many residences/locations. null = unset. */
  residencesOrLocations: number | null;
  /** Recommend Business from this many approximate rooms or beds. null = unset. */
  roomsOrBeds: number | null;
};

/** UNSET on purpose. If either value is set, reaching EITHER one recommends Business. */
export const RESIDENCE_BUSINESS_THRESHOLD: ResidenceBusinessThreshold = {
  residencesOrLocations: null,
  roomsOrBeds: null,
};

// ---- Result ------------------------------------------------------------------

export type RecommendationReason = 'large_portfolio' | 'large_residence_operation';

export type PlanOption = {
  planId: PlanId;
  eligible: boolean;
  recommended: boolean;
  /** Why this plan is not offered (only when eligible is false). */
  unavailableReason?: 'not_available_for_provider_type' | 'portfolio_too_large' | 'portfolio_too_small';
};

export type PlanEligibility = {
  /** All four plans, in display order, flagged as eligible or not. */
  options: PlanOption[];
  /** Only the plans the UI should show. */
  eligiblePlanIds: PlanId[];
  recommendedPlanId: PlanId | null;
  recommendationReason: RecommendationReason | null;
};

export const RECOMMENDATION_COPY: Record<RecommendationReason, string> = {
  large_portfolio:
    'Business is built for larger portfolios, with bulk listing management and staff accounts.',
  large_residence_operation:
    'Business is built for larger residence operations, with bulk listing management and staff accounts.',
};

function residenceRecommendsBusiness(portfolio: Portfolio, t: ResidenceBusinessThreshold): boolean {
  const byLocations = t.residencesOrLocations !== null && portfolio.propertyCount >= t.residencesOrLocations;
  const byRooms =
    t.roomsOrBeds !== null && portfolio.roomsOrBeds !== undefined && portfolio.roomsOrBeds >= t.roomsOrBeds;
  return byLocations || byRooms;
}

export function getPlanEligibility(
  providerType: ProviderType,
  portfolio: Portfolio,
  rules: Record<ProviderType, ProviderPlanRules> = PROVIDER_PLAN_RULES,
  residenceThreshold: ResidenceBusinessThreshold = RESIDENCE_BUSINESS_THRESHOLD,
): PlanEligibility {
  const rule = rules[providerType];
  const count = portfolio.propertyCount;

  const eligibility: Record<PlanId, Pick<PlanOption, 'eligible' | 'unavailableReason'>> = {
    basic:
      rule.basicMaxProperties === null
        ? { eligible: false, unavailableReason: 'not_available_for_provider_type' }
        : count > rule.basicMaxProperties
          ? { eligible: false, unavailableReason: 'portfolio_too_large' }
          : { eligible: true },
    premium: { eligible: true },
    managed_booking: { eligible: true },
    business:
      count < rule.businessAvailableFrom
        ? { eligible: false, unavailableReason: 'portfolio_too_small' }
        : { eligible: true },
  };

  let recommendationReason: RecommendationReason | null = null;
  if (eligibility.business.eligible) {
    if (providerType === 'student_residence') {
      if (residenceRecommendsBusiness(portfolio, residenceThreshold)) {
        recommendationReason = 'large_residence_operation';
      }
    } else if (rule.businessRecommendedFrom !== null && count >= rule.businessRecommendedFrom) {
      recommendationReason = 'large_portfolio';
    }
  }
  const recommendedPlanId: PlanId | null = recommendationReason ? 'business' : null;

  const options = PLAN_ORDER.map((planId) => ({
    planId,
    ...eligibility[planId],
    recommended: planId === recommendedPlanId,
  }));

  return {
    options,
    eligiblePlanIds: options.filter((o) => o.eligible).map((o) => o.planId),
    recommendedPlanId,
    recommendationReason,
  };
}
