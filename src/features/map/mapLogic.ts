// Map maths: which listings can be drawn, where the camera should look, and how overlapping price
// markers are grouped into clusters. Pure: no React Native or map-library imports, so it can be
// unit-tested without a device. The map component (components/map/PropertyMap.tsx) only draws what
// this module decides.

export type LatLng = { latitude: number; longitude: number };
export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
export type MapPoint = LatLng & { id: string };
export type Viewport = { width: number; height: number };

export type PointMarker = MapPoint & { kind: 'point' };
export type ClusterMarker = LatLng & { kind: 'cluster'; id: string; count: number; pointIds: string[] };
export type MapMarker = PointMarker | ClusterMarker;

/** Whole-country view, used when there is nothing to fit. */
export const ROMANIA_REGION: Region = { latitude: 45.9, longitude: 25.0, latitudeDelta: 6.5, longitudeDelta: 9 };

/** Smallest span the camera will fit to (about 2 km), so a single listing is not zoomed to a rooftop. */
export const MIN_FIT_DELTA = 0.02;

/** Approximate size of a price pill in pixels; markers closer than this would overlap. */
export const PILL_WIDTH_PX = 76;
export const PILL_HEIGHT_PX = 34;

export function isValidCoordinate(c: Partial<LatLng> | null | undefined): c is LatLng {
  if (!c) return false;
  const { latitude: lat, longitude: lng } = c;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(lat === 0 && lng === 0); // (0, 0) is what missing data usually looks like
}

/** Items with a usable approximate location become map points; the rest are counted, never drawn. */
export function toMapPoints(items: { id: string; approxLocation?: Partial<LatLng> | null }[]): { points: MapPoint[]; missing: number } {
  const points: MapPoint[] = [];
  let missing = 0;
  for (const item of items) {
    if (isValidCoordinate(item.approxLocation)) points.push({ id: item.id, latitude: item.approxLocation.latitude, longitude: item.approxLocation.longitude });
    else missing += 1;
  }
  return { points, missing };
}

/** A camera region that shows every point with a little padding. */
export function regionForPoints(points: LatLng[], opts: { padding?: number; minDelta?: number } = {}): Region {
  if (points.length === 0) return ROMANIA_REGION;
  const padding = opts.padding ?? 0.35;
  const minDelta = opts.minDelta ?? MIN_FIT_DELTA;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(minDelta, (maxLat - minLat) * (1 + padding)),
    longitudeDelta: Math.max(minDelta, (maxLng - minLng) * (1 + padding)),
  };
}

/**
 * Groups points whose price pills would overlap at the current zoom. Greedy and deterministic:
 * points are visited in order, and each takes every later point within one pill of it.
 * The selected point is never absorbed into a cluster, so the highlighted marker stays visible.
 */
export function clusterPoints(
  points: MapPoint[],
  region: Region,
  viewport: Viewport,
  opts: { selectedId?: string | null; pillWidthPx?: number; pillHeightPx?: number } = {},
): MapMarker[] {
  const w = opts.pillWidthPx ?? PILL_WIDTH_PX;
  const h = opts.pillHeightPx ?? PILL_HEIGHT_PX;
  if (viewport.width <= 0 || viewport.height <= 0 || region.latitudeDelta <= 0 || region.longitudeDelta <= 0) {
    return points.map((p) => ({ kind: 'point', ...p }));
  }
  const pxX = (p: LatLng) => ((p.longitude - region.longitude) / region.longitudeDelta) * viewport.width;
  const pxY = (p: LatLng) => ((region.latitude - p.latitude) / region.latitudeDelta) * viewport.height;

  const used = new Set<string>();
  const markers: MapMarker[] = [];
  points.forEach((p, i) => {
    if (used.has(p.id)) return;
    used.add(p.id);
    if (p.id === opts.selectedId) {
      markers.push({ kind: 'point', ...p });
      return;
    }
    const group = [p];
    for (let j = i + 1; j < points.length; j++) {
      const q = points[j];
      if (used.has(q.id) || q.id === opts.selectedId) continue;
      if (Math.abs(pxX(p) - pxX(q)) < w && Math.abs(pxY(p) - pxY(q)) < h) {
        group.push(q);
        used.add(q.id);
      }
    }
    if (group.length === 1) {
      markers.push({ kind: 'point', ...p });
      return;
    }
    const ids = group.map((g) => g.id);
    markers.push({
      kind: 'cluster',
      id: `cluster:${[...ids].sort().join('|')}`,
      latitude: group.reduce((a, g) => a + g.latitude, 0) / group.length,
      longitude: group.reduce((a, g) => a + g.longitude, 0) / group.length,
      count: group.length,
      pointIds: ids,
    });
  });
  return markers;
}

/**
 * Where to zoom when a cluster is tapped: a region fitted to its members. Returns null when the
 * map is already zoomed in as far as is useful (the members sit on top of each other), so the
 * caller can select a member instead of looping forever.
 */
export function regionForCluster(cluster: ClusterMarker, all: MapPoint[], current: Region): Region | null {
  const members = all.filter((p) => cluster.pointIds.includes(p.id));
  const target = regionForPoints(members, { padding: 0.6, minDelta: 0.004 });
  const smaller = target.latitudeDelta < current.latitudeDelta * 0.9 || target.longitudeDelta < current.longitudeDelta * 0.9;
  return smaller ? target : null;
}

/** Changes whenever the set or look of markers changes (used to refresh custom marker views). */
export const markerSignature = (markers: MapMarker[], selectedId: string | null): string =>
  `${selectedId ?? ''}|${markers.map((m) => (m.kind === 'point' ? m.id : `${m.id}#${m.count}`)).join(',')}`;
