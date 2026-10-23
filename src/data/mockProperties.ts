import type { Currency } from '../features/currency/types';
import type { Amenity, OwnerDirectory, OwnerIdentityStatuses, PropertyRecord, PropertyType } from './types';
import type { PlanId } from '../features/plans/types';

// FICTIONAL DEMO DATA. These are not real properties, landlords or verifications.
// Photos are random placeholder images (picsum.photos) and need an internet connection.
const photos = (seed: string, count: number) =>
  Array.from({ length: count }, (_, i) => `https://picsum.photos/seed/${seed}-${i + 1}/900/700`);

type Seed = {
  n: number;
  owner: string;
  title: string;
  area: string;
  city: string;
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  /** The landlord's ORIGINAL rent and its currency (some demo landlords price in EUR). */
  rent: [amount: number, currency: Currency];
  /** FICTIONAL, APPROXIMATE area-level position [latitude, longitude], rounded to ~100 m. Not an address. */
  loc: [latitude: number, longitude: number];
  planId: PlanId;
  uni: [string, number];
  amenities: Amenity[];
  availableFrom: string;
  photoCount: number;
  description: string;
};

const seeds: Seed[] = [
  { n: 1, owner: 'demo-owner-1', title: 'Bright studio near Tineretului Park', area: 'Tineretului', city: 'Bucharest', type: 'studio', bedrooms: 0, bathrooms: 1, rent: [2250, 'RON'], loc: [44.410, 26.105], planId: 'premium', uni: ['ASE', 12], amenities: ['furnished', 'wifi', 'washing_machine'], availableFrom: '2026-11-01', photoCount: 5, description: 'A light-filled studio with large windows, a compact kitchen and a quiet street view. Close to the park and the metro.' },
  { n: 2, owner: 'demo-owner-2', title: 'Modern room in student residence', area: 'Grozăvești', city: 'Bucharest', type: 'residence', bedrooms: 1, bathrooms: 1, rent: [330, 'EUR'], loc: [44.445, 26.064], planId: 'managed_booking', uni: ['Politehnica', 5], amenities: ['furnished', 'bills_included', 'wifi', 'private_bathroom'], availableFrom: '2026-10-15', photoCount: 6, description: 'A furnished single room in a student residence with shared kitchen, laundry and study areas.' },
  { n: 3, owner: 'demo-owner-3', title: 'Sunny two-bedroom with balcony', area: 'Mărăști', city: 'Cluj-Napoca', type: 'apartment', bedrooms: 2, bathrooms: 1, rent: [3100, 'RON'], loc: [46.781, 23.612], planId: 'premium', uni: ['UBB', 9], amenities: ['furnished', 'wifi', 'washing_machine', 'parking'], availableFrom: '2026-12-01', photoCount: 6, description: 'Two bedrooms and a sunny balcony, suited to two students sharing. Tram stop two minutes away.' },
  { n: 4, owner: 'demo-owner-4', title: 'Furnished room in shared apartment', area: 'Copou', city: 'Iași', type: 'private_room', bedrooms: 1, bathrooms: 1, rent: [1400, 'RON'], loc: [47.184, 27.568], planId: 'basic', uni: ['UAIC', 7], amenities: ['furnished', 'wifi'], availableFrom: '2026-11-15', photoCount: 4, description: 'A private furnished room in a three-person flat, with a shared kitchen and living room.' },
  { n: 5, owner: 'demo-owner-5', title: 'Compact studio near Unirii', area: 'Unirii', city: 'Bucharest', type: 'studio', bedrooms: 0, bathrooms: 1, rent: [1950, 'RON'], loc: [44.427, 26.103], planId: 'basic', uni: ['ASE', 10], amenities: ['furnished', 'bills_included'], availableFrom: '2026-11-01', photoCount: 4, description: 'A small, efficient studio in a central block. Utilities are included in the rent.' },
  { n: 6, owner: 'demo-owner-2', title: 'Two-room apartment near Politehnica', area: 'Cotroceni', city: 'Bucharest', type: 'apartment', bedrooms: 1, bathrooms: 1, rent: [520, 'EUR'], loc: [44.436, 26.067], planId: 'managed_booking', uni: ['Politehnica', 8], amenities: ['furnished', 'wifi', 'washing_machine'], availableFrom: '2026-12-15', photoCount: 7, description: 'A bedroom and separate living room in a quiet, tree-lined area of Cotroceni.' },
  { n: 7, owner: 'demo-owner-6', title: 'Shared room close to UBB', area: 'Gheorgheni', city: 'Cluj-Napoca', type: 'shared_room', bedrooms: 1, bathrooms: 1, rent: [750, 'RON'], loc: [46.770, 23.620], planId: 'basic', uni: ['UBB', 15], amenities: ['furnished', 'wifi'], availableFrom: '2026-10-20', photoCount: 3, description: 'A bed in a shared room within a friendly student apartment. A budget-friendly option.' },
  { n: 8, owner: 'demo-owner-3', title: 'Bright three-bedroom for sharing', area: 'Zorilor', city: 'Cluj-Napoca', type: 'apartment', bedrooms: 3, bathrooms: 2, rent: [840, 'EUR'], loc: [46.758, 23.575], planId: 'premium', uni: ['UBB', 12], amenities: ['furnished', 'wifi', 'washing_machine', 'parking'], availableFrom: '2027-01-10', photoCount: 8, description: 'Three bedrooms and two bathrooms, ideal for a group of friends. Parking space included.' },
  { n: 9, owner: 'demo-owner-4', title: 'Quiet studio near Palas', area: 'Centru', city: 'Iași', type: 'studio', bedrooms: 0, bathrooms: 1, rent: [330, 'EUR'], loc: [47.157, 27.587], planId: 'premium', uni: ['UAIC', 14], amenities: ['furnished', 'wifi', 'bills_included'], availableFrom: '2026-11-20', photoCount: 5, description: 'A calm studio in the city centre with everything within walking distance.' },
  { n: 10, owner: 'demo-owner-7', title: 'Residence room with private bathroom', area: 'Complexul Studențesc', city: 'Timișoara', type: 'residence', bedrooms: 1, bathrooms: 1, rent: [260, 'EUR'], loc: [45.747, 21.225], planId: 'managed_booking', uni: ['UPT', 6], amenities: ['furnished', 'private_bathroom', 'wifi', 'bills_included'], availableFrom: '2026-10-25', photoCount: 6, description: 'A single room with its own bathroom in a student residence near the campus.' },
  { n: 11, owner: 'demo-owner-5', title: 'Renovated two-bedroom in Timișoara', area: 'Circumvalațiunii', city: 'Timișoara', type: 'apartment', bedrooms: 2, bathrooms: 1, rent: [2400, 'RON'], loc: [45.754, 21.230], planId: 'basic', uni: ['UPT', 10], amenities: ['furnished', 'washing_machine'], availableFrom: '2026-12-01', photoCount: 5, description: 'A freshly renovated apartment with two bedrooms and a modern kitchen.' },
];

export const DEMO_PROPERTIES: PropertyRecord[] = seeds.map((s) => ({
  id: `demo-${s.n}`,
  ownerId: s.owner,
  source: 'demo',
  status: 'published',
  planId: s.planId,
  title: s.title,
  description: s.description,
  city: s.city,
  area: s.area,
  type: s.type,
  bedrooms: s.bedrooms,
  bathrooms: s.bathrooms,
  rent: { amount: s.rent[0], currency: s.rent[1] },
  deposit: { amount: s.rent[0], currency: s.rent[1] }, // demo: a deposit of one month's rent, in the same currency
  amenities: s.amenities,
  images: photos(`studenthome-${s.n}`, s.photoCount),
  approxLocation: { latitude: s.loc[0], longitude: s.loc[1] },
  availableFrom: s.availableFrom,
  nearestUniversity: { name: s.uni[0], minutes: s.uni[1] },
}));

export const DEMO_CITY_IMAGES: Record<string, string> = {
  Bucharest: 'https://picsum.photos/seed/city-bucharest/600/500',
  'Cluj-Napoca': 'https://picsum.photos/seed/city-cluj/600/500',
  Iași: 'https://picsum.photos/seed/city-iasi/600/500',
  Timișoara: 'https://picsum.photos/seed/city-timisoara/600/500',
};

// DEMO ONLY: simulated identity-verification outcomes for the fictional landlords. Deliberately not tied
// to plans: a Basic listing can have a verified landlord, and a Premium listing an unverified one.
export const DEMO_OWNER_IDENTITY: OwnerIdentityStatuses = {
  'demo-owner-1': 'verified',
  'demo-owner-2': 'verified',
  'demo-owner-3': 'not_started',
  'demo-owner-4': 'verified',
  'demo-owner-5': 'pending',
  'demo-owner-6': 'not_started',
  'demo-owner-7': 'more_info_required',
};

// DEMO ONLY: fictional providers shown on listing details. Names are invented.
export const DEMO_OWNERS: OwnerDirectory = {
  'demo-owner-1': { displayName: 'Mara Popescu', providerType: 'private_landlord' },
  'demo-owner-2': { displayName: 'Urban Nest Management', providerType: 'property_manager' },
  'demo-owner-3': { displayName: 'Andrei Ionescu', providerType: 'private_landlord' },
  'demo-owner-4': { displayName: 'Ioana Rusu', providerType: 'private_landlord' },
  'demo-owner-5': { displayName: 'Casa Student Agency', providerType: 'agency' },
  'demo-owner-6': { displayName: 'Radu Matei', providerType: 'private_landlord' },
  'demo-owner-7': { displayName: 'Campus Residence Timișoara', providerType: 'student_residence' },
};
