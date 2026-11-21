import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { colors, radius } from '@/theme';
import { PropertyImage } from '@/components/PropertyImage';
import { canRenderPager, nextGalleryWidth, pageHeight, safeAspectRatio } from '@/lib/galleryLayout';

type Props = { images: string[]; aspectRatio?: number; rounded?: boolean };

// Swipeable photo carousel with a "2 / 5" counter. Its HEIGHT comes from `aspectRatio`, so it is reserved by the layout
// engine and never depends on a measurement: if the first onLayout is late, lost or reports 0 (a screen being pushed), the
// photo and its placeholder are still there. The measured width is only used to page the photos exactly in any orientation
// or split-screen size. A measurement of 0 is IGNORED; the list is only rebuilt when the width really changes to another
// positive value (rotation), and then keeps the current photo. Until a width is known, the first photo is shown on its own.
export function PhotoGallery({ images, aspectRatio = 1.4, rounded = false }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const ratio = safeAspectRatio(aspectRatio);
  const height = pageHeight(width, ratio);

  // Development only: a gallery that still has no measurement after a moment is exactly the situation that used to make
  // the photos disappear. Log it (with what to look at) so it can be traced on a device.
  useEffect(() => {
    if (!__DEV__ || canRenderPager(width)) return;
    const t = setTimeout(() => console.warn('[PhotoGallery] still no layout width after 1.5 s; showing the first photo without paging', { photos: images.length, ratio }), 1500);
    return () => clearTimeout(t);
  }, [width, images.length, ratio]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (canRenderPager(width)) setIndex(Math.min(images.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))));
  };

  return (
    <View style={[styles.wrap, rounded && styles.rounded, { aspectRatio: ratio }]} onLayout={(e: LayoutChangeEvent) => {
        setWidth((prev) => nextGalleryWidth(prev, e.nativeEvent.layout.width));
      }}>
      {!canRenderPager(width) && images[0] ? <PropertyImage uri={images[0]} accessibilityLabel={`Photo 1 of ${images.length}`} style={StyleSheet.absoluteFill as object} /> : null}
      {canRenderPager(width) && (
        <FlatList
          ref={listRef}
          key={width} // re-measure after rotation
          initialScrollIndex={Math.min(index, Math.max(0, images.length - 1))}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          onMomentumScrollEnd={onEnd}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            <PropertyImage uri={item} accessibilityLabel={`Photo ${i + 1} of ${images.length}`} style={{ width, height }} />
          )}
        />
      )}
      {images.length > 1 && (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>{index + 1} / {images.length}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: colors.mint, overflow: 'hidden' },
  rounded: { borderRadius: radius.lg },
  counter: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
