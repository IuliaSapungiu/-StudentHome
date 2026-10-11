import type { CitySummary, Property, PropertySearchQuery } from './types';

/**
 * What the UI needs from a property data source. Screens depend on THIS, never on a
 * concrete source. Every method returns public (published) listings only; provider drafts
 * are handled by a separate repository later. A Supabase implementation can replace the
 * mock one without changing any screen.
 */
export interface PropertyRepository {
  search(query?: PropertySearchQuery): Promise<Property[]>;
  getById(id: string): Promise<Property | null>;
  /** For favourites: returns the public listings among the given ids. */
  getByIds(ids: string[]): Promise<Property[]>;
  getFeatured(limit?: number): Promise<Property[]>;
  getCities(): Promise<CitySummary[]>;
}
