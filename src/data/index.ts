import { dataSourceMode, demoDataEnabled, type DataSourceMode } from '../config/dataSource';
import { createMockPropertyRepository } from './mockRepository';
import type { PropertyRepository } from './repository';

export function createPropertyRepository(mode: DataSourceMode, allowDemo: boolean): PropertyRepository {
  switch (mode) {
    case 'mock':
      // Demo data off (e.g. a release build) -> an empty feed, never silent demo listings.
      return allowDemo ? createMockPropertyRepository() : createMockPropertyRepository([]);
    case 'supabase':
      throw new Error('The Supabase property repository is not implemented yet.');
  }
}

/** The single entry point screens use to read properties. */
export const propertyRepository: PropertyRepository = createPropertyRepository(dataSourceMode, demoDataEnabled);

/** True when the feed is made of fictional demo listings (show the demo notice). */
export const showsDemoData = dataSourceMode === 'mock' && demoDataEnabled;

export type { PropertyRepository } from './repository';
export * from './types';
export { isDemo, isPublic, isVerified } from './listing';
export { describeDetail, describeSize, formatRon, formatNumber } from './format';
