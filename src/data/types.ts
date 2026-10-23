import type { Money } from '../features/currency/types';
import type { PlanId, ProviderType } from '../features/plans/types';
import type { VerificationStatus } from '../features/verification/types';

export type ListingStatus = 'draft' | 'ready_to_publish' | 'payment_successful' | 'published' | 'expired';

/** 'demo' = fictional seed data. 'user' = created by a provider in the app. Never mixed implicitly. */
export type ListingSource = 'demo' | 'user';

export type PropertyType = 'studio' | 'apartment' | 'private_room' | 'shared_room' | 'residence';

export type Amenity =
  | 'furnished'
  | 'bills_included'
  | 'private_bathroom'
  | 'wifi'
  | 'washing_machine'
  | 'parking';

export type Property = {
  id: string;
  /** The provider account that owns the property (stable id, not a display name). */
  ownerId: string;
  source: ListingSource;
  status: ListingStatus;
  /**
   * Plan the listing is published under. Drives ranking and plan features ONLY. It never drives the
   * "Verified landlord" badge, which comes from the owner's identity verification. null for drafts.
   */
  planId: PlanId | null;
  title: string;
  description: string;
  city: string;
  area: string;
  type: PropertyType;
  /** 0 = studio. */
  bedrooms: number;
  bathrooms: number;
  /**
   * The landlord's ORIGINAL monthly rent and deposit, each with its own currency (RON or EUR).
   * Never assume RON. These are never overwritten by the student's display currency: converted
   * values are computed at read time (src/features/currency/money.ts) and are not stored.
   */
  rent: Money;
  deposit: Money;
  amenities: Amenity[];
  images: string[];
  /**
   * APPROXIMATE area-level position for map display (rounded to about 100 m). It is deliberately not
   * the exact address and must never be presented as a verified property location. Optional: listings
   * without it are simply left off the map.
   */
  approxLocation?: { latitude: number; longitude: number };
  /** ISO date (YYYY-MM-DD). */
  availableFrom: string;
  nearestUniversity: { name: string; minutes: number };
  /**
   * READ-MODEL FIELD, computed by the repository from the owner's identity-verification record.
   * It is not stored on the property. It says nothing about the property itself being verified.
   */
  landlordIdentityVerified: boolean;
  /** READ-MODEL FIELD: who is offering the property (display name and provider type). */
  owner: OwnerSummary;
};

/** Public information about the provider shown on a listing. */
export type OwnerSummary = { displayName: string; providerType: ProviderType };

export type OwnerDirectory = Record<string, OwnerSummary>;

/** What is stored for a property (the read model minus fields derived at read time). */
export type PropertyRecord = Omit<Property, 'landlordIdentityVerified' | 'owner'>;

export type OwnerIdentityStatuses = Record<string, VerificationStatus>;

export type CitySummary = { name: string; homeCount: number; image: string };

export type SortOption = 'recommended' | 'price_asc' | 'price_desc';

export type PropertySearchQuery = {
  /** Free text: matches title, city, area or university (accent- and case-insensitive). */
  text?: string;
  city?: string;
  /** University short name, e.g. "ASE". */
  university?: string;
  /**
   * Budget limits as RON-EQUIVALENT amounts. A listing priced in EUR is converted with the current
   * exchange-rate snapshot before it is compared, so filtering is identical whatever display
   * currency the student has chosen. Search state keeps the limits in this form.
   */
  minRentRon?: number;
  maxRentRon?: number;
  types?: PropertyType[];
  /** 0 = studio; 3 means "3 or more". Multiple values are OR-ed. */
  bedrooms?: number[];
  minBathrooms?: number;
  maxBathrooms?: number;
  maxMinutesToUniversity?: number;
  /** Every listed amenity must be present. */
  amenities?: Amenity[];
  verifiedOnly?: boolean;
  /** ISO date; keeps listings available on or before this date. */
  availableBy?: string;
  sort?: SortOption;
};
