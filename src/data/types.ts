import type { PlanId } from '../features/plans/types';

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
  source: ListingSource;
  status: ListingStatus;
  /** Plan the listing is published under. Drives Verified badge and ranking. null for drafts. */
  planId: PlanId | null;
  title: string;
  description: string;
  city: string;
  area: string;
  type: PropertyType;
  /** 0 = studio. */
  bedrooms: number;
  bathrooms: number;
  rentRon: number;
  depositRon: number;
  amenities: Amenity[];
  images: string[];
  /** ISO date (YYYY-MM-DD). */
  availableFrom: string;
  nearestUniversity: { name: string; minutes: number };
};

export type CitySummary = { name: string; homeCount: number; image: string };

export type SortOption = 'recommended' | 'price_asc' | 'price_desc';

export type PropertySearchQuery = {
  /** Free text: matches title, city, area or university (accent- and case-insensitive). */
  text?: string;
  city?: string;
  /** University short name, e.g. "ASE". */
  university?: string;
  minRentRon?: number;
  maxRentRon?: number;
  types?: PropertyType[];
  /** 0 = studio; 3 means "3 or more". Multiple values are OR-ed. */
  bedrooms?: number[];
  minBathrooms?: number;
  maxMinutesToUniversity?: number;
  /** Every listed amenity must be present. */
  amenities?: Amenity[];
  verifiedOnly?: boolean;
  /** ISO date; keeps listings available on or before this date. */
  availableBy?: string;
  sort?: SortOption;
};
