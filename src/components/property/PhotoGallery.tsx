import { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { colors, radius } from '@/theme';
import { PropertyImage } from '@/components/PropertyImage';

type Props = { images: string[]; aspectRatio?: number; rounded?: boolean };

// Swipeable photo carousel with a "2 / 5" counter. Measures its own width so paging is exact in any orientation or
// split-screen size. A measurement of 0 (what a screen can report while another screen is being pushed over it) is
// IGNORED, so the gallery keeps its size and never unmounts its photos during navigation; the list is only rebuilt
// when the width really changes to another positive value (rotation), and then keeps the current photo.
export function PhotoGallery({ images, aspectRatio = 1.4, rounded = false }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const height = width > 0 ? width / aspectRatio : 0;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.min(images.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))));
  };

  return (
    <View style={[styles.wrap, rounded && styles.rounded, { height }]} onLayout={(e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0) setWidth((prev) => (prev === w ? prev : w));
      }}>
      {width > 0 && (
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
