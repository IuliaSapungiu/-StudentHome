import type { Amenity, Property, PropertyType } from './types';
import type { PlanId } from '../features/plans/types';

// FICTIONAL DEMO DATA. These are not real properties, landlords or verifications.
// Photos are random placeholder images (picsum.photos) and need an internet connection.
const photos = (seed: string, count: number) =>
  Array.from({ length: count }, (_, i) => `https://picsum.photos/seed/${seed}-${i + 1}/900/700`);

type Seed = {
  n: number;
  title: string;
  area: string;
  city: string;
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  rentRon: number;
  planId: PlanId;
  uni: [string, number];
  amenities: Amenity[];
  availableFrom: string;
  photoCount: number;
  description: string;
};

const seeds: Seed[] = [
  { n: 1, title: 'Bright studio near Tineretului Park', area: 'Tineretului', city: 'Bucharest', type: 'studio', bedrooms: 0, bathrooms: 1, rentRon: 2250, planId: 'premium', uni: ['ASE', 12], amenities: ['furnished', 'wifi', 'washing_machine'], availableFrom: '2026-11-01', photoCount: 5, description: 'A light-filled studio with large windows, a compact kitchen and a quiet street view. Close to the park and the metro.' },
  { n: 2, title: 'Modern room in student residence', area: 'Grozăvești', city: 'Bucharest', type: 'residence', bedrooms: 1, bathrooms: 1, rentRon: 1650, planId: 'managed_booking', uni: ['Politehnica', 5], amenities: ['furnished', 'bills_included', 'wifi', 'private_bathroom'], availableFrom: '2026-10-15', photoCount: 6, description: 'A furnished single room in a student residence with shared kitchen, laundry and study areas.' },
  { n: 3, title: 'Sunny two-bedroom with balcony', area: 'Mărăști', city: 'Cluj-Napoca', type: 'apartment', bedrooms: 2, bathrooms: 1, rentRon: 3100, planId: 'premium', uni: ['UBB', 9], amenities: ['furnished', 'wifi', 'washing_machine', 'parking'], availableFrom: '2026-12-01', photoCount: 6, description: 'Two bedrooms and a sunny balcony, suited to two students sharing. Tram stop two minutes away.' },
  { n: 4, title: 'Furnished room in shared apartment', area: 'Copou', city: 'Iași', type: 'private_room', bedrooms: 1, bathrooms: 1, rentRon: 1400, planId: 'basic', uni: ['UAIC', 7], amenities: ['furnished', 'wifi'], availableFrom: '2026-11-15', photoCount: 4, description: 'A private furnished room in a three-person flat, with a shared kitchen and living room.' },
  { n: 5, title: 'Compact studio near Unirii', area: 'Unirii', city: 'Bucharest', type: 'studio', bedrooms: 0, bathrooms: 1, rentRon: 1950, planId: 'basic', uni: ['ASE', 10], amenities: ['furnished', 'bills_included'], availableFrom: '2026-11-01', photoCount: 4, description: 'A small, efficient studio in a central block. Utilities are included in the rent.' },
  { n: 6, title: 'Two-room apartment near Politehnica', area: 'Cotroceni', city: 'Bucharest', type: 'apartment', bedrooms: 1, bathrooms: 1, rentRon: 2600, planId: 'managed_booking', uni: ['Politehnica', 8], amenities: ['furnished', 'wifi', 'washing_machine'], availableFrom: '2026-12-15', photoCount: 7, description: 'A bedroom and separate living room in a quiet, tree-lined area of Cotroceni.' },
  { n: 7, title: 'Shared room close to UBB', area: 'Gheorgheni', city: 'Cluj-Napoca', type: 'shared_room', bedrooms: 1, bathrooms: 1, rentRon: 750, planId: 'basic', uni: ['UBB', 15], amenities: ['furnished', 'wifi'], availableFrom: '2026-10-20', photoCount: 3, description: 'A bed in a shared room within a friendly student apartment. A budget-friendly option.' },
  { n: 8, title: 'Bright three-bedroom for sharing', area: 'Zorilor', city: 'Cluj-Napoca', type: 'apartment', bedrooms: 3, bathrooms: 2, rentRon: 4200, planId: 'premium', uni: ['UBB', 12], amenities: ['furnished', 'wifi', 'washing_machine', 'parking'], availableFrom: '2027-01-10', photoCount: 8, description: 'Three bedrooms and two bathrooms, ideal for a group of friends. Parking space included.' },
  { n: 9, title: 'Quiet studio near Palas', area: 'Centru', city: 'Iași', type: 'studio', bedrooms: 0, bathrooms: 1, rentRon: 1650, planId: 'premium', uni: ['UAIC', 14], amenities: ['furnished', 'wifi', 'bills_included'], availableFrom: '2026-11-20', photoCount: 5, description: 'A calm studio in the city centre with everything within walking distance.' },
  { n: 10, title: 'Residence room with private bathroom', area: 'Complexul Studențesc', city: 'Timișoara', type: 'residence', bedrooms: 1, bathrooms: 1, rentRon: 1300, planId: 'managed_booking', uni: ['UPT', 6], amenities: ['furnished', 'private_bathroom', 'wifi', 'bills_included'], availableFrom: '2026-10-25', photoCount: 6, description: 'A single room with its own bathroom in a student residence near the campus.' },
  { n: 11, title: 'Renovated two-bedroom in Timișoara', area: 'Circumvalațiunii', city: 'Timișoara', type: 'apartment', bedrooms: 2, bathrooms: 1, rentRon: 2400, planId: 'basic', uni: ['UPT', 10], amenities: ['furnished', 'washing_machine'], availableFrom: '2026-12-01', photoCount: 5, description: 'A freshly renovated apartment with two bedrooms and a modern kitchen.' },
];

export const DEMO_PROPERTIES: Property[] = seeds.map((s) => ({
  id: `demo-${s.n}`,
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
  rentRon: s.rentRon,
  depositRon: s.rentRon,
  amenities: s.amenities,
  images: photos(`studenthome-${s.n}`, s.photoCount),
  availableFrom: s.availableFrom,
  nearestUniversity: { name: s.uni[0], minutes: s.uni[1] },
}));

export const DEMO_CITY_IMAGES: Record<string, string> = {
  Bucharest: 'https://picsum.photos/seed/city-bucharest/600/500',
  'Cluj-Napoca': 'https://picsum.photos/seed/city-cluj/600/500',
  Iași: 'https://picsum.photos/seed/city-iasi/600/500',
  Timișoara: 'https://picsum.photos/seed/city-timisoara/600/500',
};
