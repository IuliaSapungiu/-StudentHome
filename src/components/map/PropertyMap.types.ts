import type { Property } from '@/data';

// Shared by PropertyMap.tsx (iOS / Android) and PropertyMap.web.tsx (web fallback).
export type PropertyMapProps = {
  /** The SAME filtered results the list shows. Listings without a usable location are skipped and counted. */
  properties: Property[];
  selectedId: string | null;
  /** Tapping a price marker selects it (never navigates); tapping the map background passes null. */
  onSelect: (id: string | null) => void;
  /** Tapping the preview card opens Property Detail. */
  onOpen: (id: string) => void;
  /** Height of the preview card in pixels (0 when none), so the screen can keep the List/Map toggle clear of it. */
  onPreviewHeightChange?: (height: number) => void;
  /** Web fallback only: goes back to the list view. */
  onShowList?: () => void;
};
