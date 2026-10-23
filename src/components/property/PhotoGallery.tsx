import { useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { colors, radius } from '@/theme';

type Props = { images: string[]; aspectRatio?: number; rounded?: boolean };

// Swipeable photo carousel with a "2 / 5" counter. Measures its own width so paging is exact in
// any orientation or split-screen size.
export function PhotoGallery({ images, aspectRatio = 1.4, rounded = false }: Props) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const height = width > 0 ? width / aspectRatio : 0;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.min(images.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))));
  };

  return (
    <View style={[styles.wrap, rounded && styles.rounded, { height }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          ref={listRef}
          key={width} // re-measure after rotation
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          onMomentumScrollEnd={onEnd}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            <Image source={{ uri: item }} accessibilityLabel={`Photo ${i + 1} of ${images.length}`} style={{ width, height }} resizeMode="cover" />
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
