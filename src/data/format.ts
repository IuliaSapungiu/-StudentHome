import { formatIsoDate } from '../lib/dates';
import type { ProviderType } from '../features/plans/types';
import type { Property } from './types';

/** 2250 -> "2.250" (Romanian thousands separator; avoids depending on Intl support). */
export const formatNumber = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatRon = (n: number) => `${formatNumber(n)} lei`;

export function describeSize(p: Pick<Property, 'type' | 'bedrooms'>): string {
  if (p.type === 'studio') return 'Studio';
  if (p.type === 'private_room') return 'Private room';
  if (p.type === 'shared_room') return 'Shared room';
  return `${p.bedrooms} ${p.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`;
}

/** e.g. "Studio · 12 min to ASE" */
export function describeDetail(p: Property): string {
  const { name, minutes } = p.nearestUniversity;
  return `${describeSize(p)} · ${minutes} min to ${name}`;
}

/** Listings available on or before today read "Available now"; later ones show their date. */
export function describeAvailability(availableFrom: string, todayIso: string): string {
  return availableFrom <= todayIso ? 'Available now' : `Available from ${formatIsoDate(availableFrom)}`;
}

const PROVIDER_LABEL: Record<ProviderType, string> = {
  private_landlord: 'Private landlord',
  property_manager: 'Property manager',
  agency: 'Agency',
  student_residence: 'Student residence',
};

export const describeProviderType = (t: ProviderType): string => PROVIDER_LABEL[t];

const AMENITY_LABEL = {
  furnished: 'Furnished',
  bills_included: 'Bills included',
  private_bathroom: 'Private bathroom',
  wifi: 'Wi-Fi',
  washing_machine: 'Washing machine',
  parking: 'Parking',
} as const;

export const describeAmenity = (a: keyof typeof AMENITY_LABEL): string => AMENITY_LABEL[a];

const TYPE_LABEL = {
  studio: 'Studio',
  apartment: 'Apartment',
  private_room: 'Private room',
  shared_room: 'Shared room',
  residence: 'Residence',
} as const;

export const describePropertyType = (t: keyof typeof TYPE_LABEL): string => TYPE_LABEL[t];
