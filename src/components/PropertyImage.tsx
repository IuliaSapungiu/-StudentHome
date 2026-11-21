import { useEffect, useReducer, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ImageStyle } from 'react-native';
import { Image as CachedImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { imageCacheKey, initialImageState, isStaleImageEvent, reduceImage, retryDelayMs, type ImageLoadEvent } from '@/lib/imageLoading';

type Props = {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  /** Small images (thumbnails) show only an icon when a photo cannot be loaded. */
  compact?: boolean;
};

/**
 * The one component every property photo goes through. It caches images on disk and in memory, keeps the space
 * reserved (so layouts never jump or collapse), retries a failed load by itself a couple of times, then offers
 * "tap to retry". A photo that has loaded is never replaced by a fallback. Works the same for local assets and for
 * future remote URLs (for example Supabase Storage).
 */
export function PropertyImage({ uri, style, accessibilityLabel, compact }: Props) {
  const [state, dispatch] = useReducer(reduceImage, uri ?? null, initialImageState);
  const latest = useRef(state);
  latest.current = state;
  // Every report from the image says which load it belongs to (see lib/imageLoading.ts), so a late event from an older
  // source or an earlier retry cannot change the current photo's state. In development, such a stray report and every
  // real failure are logged, to help find the cause if a photo ever goes missing again.
  const report = (e: ImageLoadEvent) => {
    if (__DEV__) {
      if (isStaleImageEvent(latest.current, e)) console.warn('[PropertyImage] ignored a stale image event', { event: e, current: { uri: latest.current.uri, nonce: latest.current.nonce, status: latest.current.status } });
      else if (e.type === 'failed') console.warn('[PropertyImage] load failed', { uri: latest.current.uri, attempt: latest.current.attempts + 1, nonce: latest.current.nonce });
    }
    dispatch(e);
  };

  useEffect(() => {
    dispatch({ type: 'source', uri: uri ?? null });
  }, [uri]);

  useEffect(() => {
    if (state.status !== 'retrying') return;
    const t = setTimeout(() => dispatch({ type: 'retry_timer' }), retryDelayMs(state.attempts));
    return () => clearTimeout(t);
  }, [state.status, state.attempts]);

  return (
    <View style={[styles.box, style as object]}>
      {state.uri ? (
        <CachedImage
          key={`${state.uri}|${state.nonce}`}
          source={{ uri: state.uri, cacheKey: imageCacheKey(state.uri) }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={150}
          accessibilityLabel={accessibilityLabel}
          style={StyleSheet.absoluteFill}
          onLoad={() => report({ type: 'loaded', uri: state.uri, nonce: state.nonce })}
          onError={() => report({ type: 'failed', uri: state.uri, nonce: state.nonce })}
        />
      ) : null}
      {state.status === 'error' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Photo unavailable. Tap to retry" disabled={!state.uri} onPress={() => dispatch({ type: 'user_retry' })} style={styles.fallback}>
          <Ionicons name="image-outline" size={compact ? 16 : 28} color={colors.primary} />
          {compact ? null : <Text style={styles.fallbackText}>{state.uri ? 'Photo unavailable · tap to retry' : 'No photo'}</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.mint, overflow: 'hidden' },
  fallback: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.mint },
  fallbackText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
