// Load state for a remote or local image, kept free of React so it can be tested. The rules:
//  - a failed load is retried automatically a few times (with a growing delay), because the usual cause is a brief
//    network or CDN hiccup, and then offers "tap to retry": it never gets stuck blank for good;
//  - an image that has loaded successfully is NEVER replaced by a fallback;
//  - changing the source resets everything; each retry changes `nonce`, which makes the image component start a fresh load;
//  - a `loaded` / `failed` report says WHICH load it belongs to (the source and the nonce of the image that sent it). A
//    report from an older load (a previous photo shown by the same component, or an earlier retry that was already
//    replaced) is IGNORED, so a late error of an old request can never mark the current photo as failed.

export const MAX_AUTO_RETRIES = 2;

export type ImageLoadState = {
  uri: string | null;
  status: 'loading' | 'loaded' | 'retrying' | 'error';
  /** Automatic retries used so far for the current source. */
  attempts: number;
  /** Changes on every retry so the image restarts its request. */
  nonce: number;
};

/** Which load a `loaded` / `failed` report belongs to: the source and the nonce the reporting image was started with. */
export type ImageLoadOrigin = { uri: string | null; nonce: number };

export type ImageLoadEvent =
  | ({ type: 'loaded' } & ImageLoadOrigin)
  | ({ type: 'failed' } & ImageLoadOrigin)
  | { type: 'retry_timer' }
  | { type: 'user_retry' }
  | { type: 'source'; uri: string | null };

/** True for a `loaded` / `failed` report that does not belong to the load the state is currently waiting for. */
export const isStaleImageEvent = (state: ImageLoadState, e: ImageLoadEvent): boolean =>
  (e.type === 'loaded' || e.type === 'failed') && (e.uri !== state.uri || e.nonce !== state.nonce);

export const initialImageState = (uri: string | null): ImageLoadState => ({ uri, status: uri ? 'loading' : 'error', attempts: 0, nonce: 0 });

export function reduceImage(state: ImageLoadState, e: ImageLoadEvent): ImageLoadState {
  if (isStaleImageEvent(state, e)) return state;
  switch (e.type) {
    case 'source':
      return e.uri === state.uri ? state : initialImageState(e.uri);
    case 'loaded':
      return state.status === 'loaded' ? state : { ...state, status: 'loaded', attempts: 0 };
    case 'failed':
      if (state.status === 'loaded' || state.status === 'error') return state; // a loaded image is never replaced by an error
      return state.attempts < MAX_AUTO_RETRIES ? { ...state, status: 'retrying', attempts: state.attempts + 1 } : { ...state, status: 'error' };
    case 'retry_timer':
      return state.status === 'retrying' ? { ...state, status: 'loading', nonce: state.nonce + 1 } : state;
    case 'user_retry':
      return state.uri && state.status === 'error' ? { ...state, status: 'loading', attempts: 0, nonce: state.nonce + 1 } : state;
  }
}

/** Wait before automatic retry number `attempts` (1-based): 700 ms, then 1.4 s. */
export const retryDelayMs = (attempts: number): number => 700 * 2 ** Math.max(0, attempts - 1);

/**
 * A stable cache key for an image: the address without its query string or fragment. Signed storage URLs (for example
 * from Supabase Storage) get a new token every time they are issued; keying the cache on the part that does not change
 * keeps a cached image valid instead of downloading it again each time.
 */
export function imageCacheKey(uri: string): string {
  const cut = uri.search(/[?#]/);
  return cut === -1 ? uri : uri.slice(0, cut);
}
