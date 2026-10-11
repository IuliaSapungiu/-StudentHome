// Chooses where property data comes from. Change it explicitly - never implicitly.
//   EXPO_PUBLIC_DATA_SOURCE=mock       (default) fictional demo data, no backend
//   EXPO_PUBLIC_DATA_SOURCE=supabase   real data (not implemented yet)
export type DataSourceMode = 'mock' | 'supabase';

export const dataSourceMode: DataSourceMode =
  process.env.EXPO_PUBLIC_DATA_SOURCE === 'supabase' ? 'supabase' : 'mock';

// Demo listings are allowed in development builds. In release builds they stay OFF unless a
// build explicitly sets EXPO_PUBLIC_ALLOW_DEMO_DATA=true (e.g. an internal test build).
export const demoDataEnabled: boolean =
  dataSourceMode === 'mock' && (__DEV__ || process.env.EXPO_PUBLIC_ALLOW_DEMO_DATA === 'true');
