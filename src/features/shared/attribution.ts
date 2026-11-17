import type { PlanId } from '../plans/types';

// Where a conversation, viewing request or application came from, and which plan the listing was on at that
// moment. Kept so a LATER rental-confirmation milestone can attribute outcomes. Nothing here counts as a
// rental: an accepted application, a completed viewing or an expired listing is never a confirmed rental.
export const CONTACT_ORIGINS = ['property_detail', 'conversation', 'viewings', 'saved', 'viewing_update', 'other'] as const;
export type ContactOrigin = (typeof CONTACT_ORIGINS)[number];

export type Attribution = { origin: ContactOrigin; listingPlanId: PlanId | null };
