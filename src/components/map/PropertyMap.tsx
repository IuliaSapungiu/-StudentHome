import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { colors, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useSearch } from '@/features/search/SearchProvider';
import {
  clusterPoints,
  markerSignature,
  regionForCluster,
  regionForPoints,
  toMapPoints,
  type Viewport,
} from '@/features/map/mapLogic';
import { ClusterBubble, PricePill } from './MapMarkers';
import { MapPreviewCard } from './MapPreviewCard';
import type { PropertyMapProps } from './PropertyMap.types';

// The ONLY file that imports react-native-maps (enforced by src/architecture.test.ts). It draws
// what src/features/map/mapLogic.ts decides: which listings have a position, where the camera
// looks, and which markers are grouped into clusters.
//
// Locations are fictional and approximate (area level, ~100 m). They are NOT exact addresses and
// are not verified property locations, and the map says so.
export default function PropertyMap({ properties, selectedId, onSelect, onOpen, onPreviewHeightChange }: PropertyMapProps) {
  const { formatPrice, currency } = useSearch();
  const layout = useResponsive();
  const mapRef = useRef<MapView>(null);
  const { points, missing } = useMemo(() => toMapPoints(properties), [properties]);
  const pointsKey = points.map((p) => p.id).join(',');
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const [region, setRegion] = useState<Region>(() => regionForPoints(points));
  const [tracking, setTracking] = useState(true);

  // Fit the camera when the SET of listings changes (new search / filters), never on selection.
  useEffect(() => {
    if (points.length === 0) return;
    mapRef.current?.animateToRegion(regionForPoints(points), 350); // onRegionChangeComplete updates `region`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  const markers = useMemo(() => clusterPoints(points, region, viewport, { selectedId }), [points, region, viewport, selectedId]);

  // Custom marker views are drawn to an image: let them refresh briefly when what they show changes.
  const signature = `${markerSignature(markers, selectedId)}|${currency}`;
  const [trackedSignature, setTrackedSignature] = useState(signature);
  if (trackedSignature !== signature) {
    setTrackedSignature(signature);
    setTracking(true);
  }
  useEffect(() => {
    const id = setTimeout(() => setTracking(false), 600);
    return () => clearTimeout(id);
  }, [signature]);

  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const hasSelection = selected !== null;
  useEffect(() => {
    if (!hasSelection) onPreviewHeightChange?.(0);
  }, [hasSelection, onPreviewHeightChange]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
  }, []);

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        style={styles.fill}
        initialRegion={region}
        onRegionChangeComplete={(r) => setRegion(r)}
        onPress={() => onSelect(null)}
        moveOnMarkerPress={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        showsCompass={false}>
        {markers.map((m) =>
          m.kind === 'cluster' ? (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={tracking}
              accessibilityLabel={`${m.count} homes. Double tap to zoom in.`}
              onPress={(e) => {
                e.stopPropagation?.();
                const target = regionForCluster(m, points, region);
                if (target) mapRef.current?.animateToRegion(target, 350);
                else onSelect(m.pointIds[0]); // members sit on top of each other: show the first one
              }}>
              <ClusterBubble count={m.count} />
            </Marker>
          ) : (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={m.id === selectedId ? 10 : 1}
              tracksViewChanges={tracking}
              accessibilityLabel={byId.get(m.id) ? `${formatPrice(byId.get(m.id)!.rent, { plain: true })} per month, ${byId.get(m.id)!.title}` : undefined}
              onPress={(e) => {
                e.stopPropagation?.();
                onSelect(m.id);
              }}>
              <PricePill label={byId.get(m.id) ? formatPrice(byId.get(m.id)!.rent, { plain: true }) : ''} selected={m.id === selectedId} />
            </Marker>
          ),
        )}
      </MapView>

      <View pointerEvents="none" style={styles.notes}>
        <Text style={styles.note}>Approximate locations</Text>
        {missing > 0 && (
          <Text style={styles.note}>
            {missing} {missing === 1 ? 'home has' : 'homes have'} no map location
          </Text>
        )}
      </View>

      {points.length === 0 && properties.length > 0 && (
        <View pointerEvents="none" style={styles.centerNote}>
          <Text style={styles.centerText}>None of these homes has a map location yet. Switch to the list to see them.</Text>
        </View>
      )}

      {selected && (
        <View pointerEvents="box-none" style={[styles.cardWrap, { left: layout.gutter > 24 ? layout.gutter : spacing.md, right: layout.gutter > 24 ? layout.gutter : spacing.md }]}>
          <View style={styles.cardInner}>
            <MapPreviewCard property={selected} onOpen={onOpen} onLayout={(e) => onPreviewHeightChange?.(e.nativeEvent.layout.height)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  notes: { position: 'absolute', top: spacing.sm, left: spacing.sm, gap: 4, alignItems: 'flex-start' },
  note: { fontSize: 11, color: colors.text, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  centerNote: { position: 'absolute', top: '40%', left: spacing.lg, right: spacing.lg, backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md },
  centerText: { fontSize: 13, color: colors.text, textAlign: 'center' },
  cardWrap: { position: 'absolute', bottom: spacing.md, alignItems: 'center' },
  cardInner: { width: '100%', maxWidth: 560 },
});
