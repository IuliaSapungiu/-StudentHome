import { toRon } from '../features/currency/money';
import type { ExchangeRateSnapshot } from '../features/currency/types';
import { hasHigherRanking, isPublic, isVerified } from './listing';
import type { Property, PropertySearchQuery } from './types';

const normalize = (s: string) => {
  const lower = s.toLowerCase();
  return typeof lower.normalize === 'function' ? lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : lower;
};

/**
 * Pure search/filter/sort over a list. Only ever returns public (published) listings.
 * Prices are compared in RON-equivalent terms using `rate`, so listings whose original rent is in
 * EUR and listings in RON are filtered and sorted together, whatever currency the student sees.
 */
export function filterProperties(all: Property[], q: PropertySearchQuery = {}, rate: ExchangeRateSnapshot): Property[] {
  const text = q.text ? normalize(q.text.trim()) : '';
  const priceRon = (p: Property) => toRon(p.rent, rate);

  const result = all.filter((p) => {
    if (!isPublic(p)) return false;
    if (text) {
      const haystack = normalize(`${p.title} ${p.city} ${p.area} ${p.nearestUniversity.name}`);
      if (!haystack.includes(text)) return false;
    }
    if (q.city && normalize(p.city) !== normalize(q.city)) return false;
    if (q.university && normalize(p.nearestUniversity.name) !== normalize(q.university)) return false;
    if (q.minRentRon !== undefined && priceRon(p) < q.minRentRon) return false;
    if (q.maxRentRon !== undefined && priceRon(p) > q.maxRentRon) return false;
    if (q.types?.length && !q.types.includes(p.type)) return false;
    if (q.bedrooms?.length && !q.bedrooms.some((b) => (b >= 3 ? p.bedrooms >= 3 : p.bedrooms === b))) return false;
    if (q.minBathrooms !== undefined && p.bathrooms < q.minBathrooms) return false;
    if (q.maxBathrooms !== undefined && p.bathrooms > q.maxBathrooms) return false;
    if (q.maxMinutesToUniversity !== undefined && p.nearestUniversity.minutes > q.maxMinutesToUniversity) return false;
    if (q.amenities?.length && !q.amenities.every((a) => p.amenities.includes(a))) return false;
    if (q.verifiedOnly && !isVerified(p)) return false;
    if (q.availableBy && p.availableFrom > q.availableBy) return false;
    return true;
  });

  const sort = q.sort ?? 'recommended';
  const indexed = result.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => {
    if (sort === 'price_asc') return priceRon(a.p) - priceRon(b.p) || a.i - b.i;
    if (sort === 'price_desc') return priceRon(b.p) - priceRon(a.p) || a.i - b.i;
    // recommended: plans with higher ranking first, otherwise keep original order
    return Number(hasHigherRanking(b.p)) - Number(hasHigherRanking(a.p)) || a.i - b.i;
  });
  return indexed.map((x) => x.p);
}
