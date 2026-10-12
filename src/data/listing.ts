import { planIncludes } from '../features/plans/plans';
import type { Property } from './types';

/** Only published listings are visible to students. Drafts and expired listings never are. */
export const isPublic = (p: Property) => p.status === 'published';

export const isDemo = (p: Property) => p.source === 'demo';

/** "Verified landlord": depends on the landlord's identity verification, never on the plan. Not property verification. */
export const isVerified = (p: Property) => p.landlordIdentityVerified;

export const hasHigherRanking = (p: Property) => p.planId !== null && planIncludes(p.planId, 'higherRanking');
