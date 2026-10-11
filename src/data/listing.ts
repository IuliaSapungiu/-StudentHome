import { planIncludes } from '../features/plans/plans';
import type { Property } from './types';

/** Only published listings are visible to students. Drafts and expired listings never are. */
export const isPublic = (p: Property) => p.status === 'published';

export const isDemo = (p: Property) => p.source === 'demo';

/** Verified is a plan feature - it is never a free-floating flag on a listing. */
export const isVerified = (p: Property) => p.planId !== null && planIncludes(p.planId, 'verifiedBadge');

export const hasHigherRanking = (p: Property) => p.planId !== null && planIncludes(p.planId, 'higherRanking');
