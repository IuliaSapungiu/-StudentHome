import { filterProperties } from './filterProperties';
import { isPublic } from './listing';
import { DEMO_CITY_IMAGES, DEMO_PROPERTIES } from './mockProperties';
import type { PropertyRepository } from './repository';
import type { CitySummary, Property } from './types';

const FALLBACK_CITY_IMAGE = 'https://picsum.photos/seed/city-default/600/500';

export function createMockPropertyRepository(source: Property[] = DEMO_PROPERTIES): PropertyRepository {
  // Even if drafts are passed in, they can never be returned from here.
  const publicOnly = () => source.filter(isPublic);

  return {
    async search(query) {
      return filterProperties(publicOnly(), query);
    },
    async getById(id) {
      return publicOnly().find((p) => p.id === id) ?? null;
    },
    async getByIds(ids) {
      return publicOnly().filter((p) => ids.includes(p.id));
    },
    async getFeatured(limit = 6) {
      return filterProperties(publicOnly(), { sort: 'recommended' }).slice(0, limit);
    },
    async getCities() {
      const counts = new Map<string, number>();
      for (const p of publicOnly()) counts.set(p.city, (counts.get(p.city) ?? 0) + 1);
      const cities: CitySummary[] = [...counts].map(([name, homeCount]) => ({
        name,
        homeCount,
        image: DEMO_CITY_IMAGES[name] ?? FALLBACK_CITY_IMAGE,
      }));
      return cities.sort((a, b) => b.homeCount - a.homeCount || a.name.localeCompare(b.name));
    },
  };
}
