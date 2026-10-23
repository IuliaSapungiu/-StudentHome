/// <reference types="node" />
import assert from 'node:assert/strict';
import { DEMO_PROPERTIES } from '../../data/mockProperties';
import {
  MIN_FIT_DELTA,
  ROMANIA_REGION,
  clusterPoints,
  isValidCoordinate,
  markerSignature,
  regionForCluster,
  regionForPoints,
  toMapPoints,
  type ClusterMarker,
  type MapPoint,
  type Region,
} from './mapLogic';

const viewport = { width: 390, height: 600 };
const demo: MapPoint[] = DEMO_PROPERTIES.map((p) => ({ id: p.id, latitude: p.approxLocation!.latitude, longitude: p.approxLocation!.longitude }));
const byId = (id: string) => demo.find((p) => p.id === id)!;

// ---- Coordinates and missing data ----
assert.ok(isValidCoordinate({ latitude: 44.4, longitude: 26.1 }));
for (const bad of [null, undefined, {}, { latitude: 44.4 }, { latitude: NaN, longitude: 26 }, { latitude: 91, longitude: 26 }, { latitude: 44, longitude: 181 }, { latitude: 0, longitude: 0 }]) {
  assert.equal(isValidCoordinate(bad as never), false);
}
const mixed = toMapPoints([
  { id: 'a', approxLocation: { latitude: 44.41, longitude: 26.1 } },
  { id: 'b' },
  { id: 'c', approxLocation: { latitude: NaN, longitude: 26.1 } },
  { id: 'd', approxLocation: { latitude: 46.78, longitude: 23.6 } },
]);
assert.deepEqual(mixed.points.map((p) => p.id), ['a', 'd'], 'order is preserved and bad coordinates are skipped');
assert.equal(mixed.missing, 2, 'skipped listings are counted, not hidden silently');
assert.deepEqual(toMapPoints([]), { points: [], missing: 0 });
assert.equal(toMapPoints(DEMO_PROPERTIES).missing, 0);

// ---- Camera region ----
assert.deepEqual(regionForPoints([]), ROMANIA_REGION);
const one = regionForPoints([{ latitude: 44.41, longitude: 26.1 }]);
assert.equal(one.latitude, 44.41);
assert.equal(one.latitudeDelta, MIN_FIT_DELTA, 'a single listing is not zoomed to a rooftop');
const bucharest = regionForPoints(['demo-1', 'demo-2', 'demo-5', 'demo-6'].map(byId));
for (const id of ['demo-1', 'demo-2', 'demo-5', 'demo-6']) {
  const p = byId(id);
  assert.ok(Math.abs(p.latitude - bucharest.latitude) <= bucharest.latitudeDelta / 2, `${id} is inside the fitted latitude span`);
  assert.ok(Math.abs(p.longitude - bucharest.longitude) <= bucharest.longitudeDelta / 2, `${id} is inside the fitted longitude span`);
}
const country = regionForPoints(demo);
assert.ok(country.latitudeDelta > 1, 'all four cities need a country-sized view');

// ---- Clustering ----
const countryMarkers = clusterPoints(demo, country, viewport);
assert.ok(countryMarkers.length < demo.length, 'overlapping markers are grouped when zoomed out');
assert.equal(countryMarkers.reduce((n, m) => n + (m.kind === 'cluster' ? m.count : 1), 0), demo.length, 'no listing is lost or duplicated');
const bucharestCluster = countryMarkers.find((m) => m.kind === 'cluster' && m.pointIds.includes('demo-1')) as ClusterMarker;
assert.ok(bucharestCluster && ['demo-2', 'demo-5', 'demo-6'].every((id) => bucharestCluster.pointIds.includes(id)), 'Bucharest listings group together');
assert.ok(bucharestCluster.count >= 2 && bucharestCluster.id.startsWith('cluster:'));
// stable and deterministic
assert.deepEqual(clusterPoints(demo, country, viewport), countryMarkers);
assert.deepEqual(clusterPoints([...demo].reverse(), country, viewport).map((m) => m.id).sort(), countryMarkers.map((m) => m.id).sort());

// zoomed in on Bucharest, listings 1 and 5 (about 2 km apart) separate into individual price markers
const zoomed: Region = { latitude: 44.43, longitude: 26.085, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const closeUp = clusterPoints(['demo-1', 'demo-2', 'demo-5', 'demo-6'].map(byId), zoomed, viewport);
assert.equal(closeUp.length, 4, 'zoomed in, every listing shows its own price marker');
assert.ok(closeUp.every((m) => m.kind === 'point'));
// zoom in further than that and nothing can cluster
const tight = clusterPoints(demo, { ...zoomed, latitudeDelta: 0.01, longitudeDelta: 0.01 }, viewport);
assert.ok(tight.every((m) => m.kind === 'point'));
// pills only cluster when they would actually overlap
const farApart = clusterPoints([{ id: 'x', latitude: 44.4, longitude: 26.0 }, { id: 'y', latitude: 44.4, longitude: 26.2 }], { ...zoomed, longitudeDelta: 0.4 }, viewport);
assert.equal(farApart.length, 2);
const twins = clusterPoints([{ id: 'x', latitude: 44.4, longitude: 26.0 }, { id: 'y', latitude: 44.4005, longitude: 26.0005 }], zoomed, viewport);
assert.equal(twins.length, 1);
assert.equal(twins[0].kind, 'cluster');

// ---- Selection ----
const withSelection = clusterPoints(demo, country, viewport, { selectedId: 'demo-1' });
const sel = withSelection.find((m) => m.id === 'demo-1');
assert.ok(sel && sel.kind === 'point', 'the selected listing always keeps its own marker');
assert.ok(!withSelection.some((m) => m.kind === 'cluster' && m.pointIds.includes('demo-1')), 'and is never inside a cluster');
assert.equal(withSelection.reduce((n, m) => n + (m.kind === 'cluster' ? m.count : 1), 0), demo.length);
assert.deepEqual(clusterPoints(demo, country, viewport, { selectedId: 'nope' }), countryMarkers, 'an unknown selection changes nothing');
// selecting a different marker changes the signature so custom marker views refresh
assert.notEqual(markerSignature(countryMarkers, 'demo-1'), markerSignature(countryMarkers, 'demo-2'));
assert.notEqual(markerSignature(countryMarkers, null), markerSignature(withSelection, null));

// ---- Tapping a cluster zooms in until its members separate ----
let region: Region = country;
let markers = clusterPoints(demo, region, viewport);
for (let i = 0; i < 12 && markers.some((m) => m.kind === 'cluster'); i++) {
  const c = markers.find((m) => m.kind === 'cluster') as ClusterMarker;
  const next = regionForCluster(c, demo, region);
  if (!next) break;
  assert.ok(next.latitudeDelta < region.latitudeDelta || next.longitudeDelta < region.longitudeDelta, 'each tap zooms in');
  region = next;
  markers = clusterPoints(demo, region, viewport);
}
assert.ok(markers.length > 1);
// members on top of each other cannot be separated by zooming: no endless loop
const stacked: MapPoint[] = [{ id: 'p', latitude: 44.4, longitude: 26.1 }, { id: 'q', latitude: 44.4, longitude: 26.1 }];
const stackedCluster = clusterPoints(stacked, zoomed, viewport)[0] as ClusterMarker;
assert.equal(stackedCluster.kind, 'cluster');
let r2: Region | null = zoomed;
for (let i = 0; i < 20 && r2; i++) r2 = regionForCluster(stackedCluster, stacked, r2);
assert.equal(r2, null, 'zooming stops once the region cannot get smaller');

// ---- Degenerate viewports ----
assert.equal(clusterPoints(demo, zoomed, { width: 0, height: 0 }).length, demo.length);
assert.deepEqual(clusterPoints([], zoomed, viewport), []);

console.log('map: all checks passed');
