/// <reference types="node" />
import assert from 'node:assert/strict';
import { imageCacheKey, initialImageState, MAX_AUTO_RETRIES, reduceImage, retryDelayMs, type ImageLoadEvent, type ImageLoadState } from './imageLoading';

const run = (s: ImageLoadState, ...events: ImageLoadEvent[]) => events.reduce(reduceImage, s);
const uri = 'https://images.example/photo.jpg?token=abc';

// starts loading; success is final
let s = initialImageState(uri);
assert.equal(s.status, 'loading');
assert.equal(run(s, { type: 'loaded' }).status, 'loaded');

// a failed load retries by itself (a brief hiccup must not leave a blank), with a fresh request each time
s = run(s, { type: 'failed' });
assert.deepEqual([s.status, s.attempts], ['retrying', 1]);
s = run(s, { type: 'retry_timer' });
assert.deepEqual([s.status, s.nonce], ['loading', 1], 'a retry restarts the request (new nonce)');
s = run(s, { type: 'failed' }, { type: 'retry_timer' });
assert.equal(s.nonce, 2);
assert.equal(s.attempts, MAX_AUTO_RETRIES);
// after the automatic retries it shows the fallback, which is NOT permanent: tapping retry tries again
s = run(s, { type: 'failed' });
assert.equal(s.status, 'error');
s = run(s, { type: 'user_retry' });
assert.deepEqual([s.status, s.attempts, s.nonce], ['loading', 0, 3], 'tap to retry starts over');
assert.equal(run(s, { type: 'loaded' }).status, 'loaded', 'and a later success shows the photo');

// a photo that loaded is never replaced by a fallback, even if a later event reports a failure
const shown = run(initialImageState(uri), { type: 'loaded' });
assert.equal(run(shown, { type: 'failed' }).status, 'loaded');
assert.equal(run(shown, { type: 'failed' }, { type: 'retry_timer' }).status, 'loaded');
assert.equal(run(shown, { type: 'user_retry' }).status, 'loaded', 'retry only exists in the error state');

// stray timer events do nothing
assert.equal(run(initialImageState(uri), { type: 'retry_timer' }).nonce, 0);

// a new source resets everything; the same source changes nothing
const failedState = run(initialImageState(uri), { type: 'failed' }, { type: 'retry_timer' }, { type: 'failed' }, { type: 'retry_timer' }, { type: 'failed' });
assert.equal(failedState.status, 'error');
const other = run(failedState, { type: 'source', uri: 'https://images.example/other.jpg' });
assert.deepEqual([other.status, other.attempts, other.nonce], ['loading', 0, 0], 'a different image starts fresh');
assert.equal(run(failedState, { type: 'source', uri }), failedState, 'the same source keeps its state (no flicker on re-render)');

// no image at all: an inline "no photo" state, nothing to retry
const none = initialImageState(null);
assert.equal(none.status, 'error');
assert.equal(run(none, { type: 'user_retry' }), none);
assert.equal(run(none, { type: 'source', uri }).status, 'loading', 'an image arriving later loads normally');

// timing and cache keys (stable across re-issued signed URLs)
assert.deepEqual([1, 2, 3].map(retryDelayMs), [700, 1400, 2800]);
assert.equal(imageCacheKey('https://x.supabase.co/storage/v1/object/sign/p/1.jpg?token=aaa'), imageCacheKey('https://x.supabase.co/storage/v1/object/sign/p/1.jpg?token=bbb'), 'a new signed token reuses the cached image');
assert.equal(imageCacheKey('https://picsum.photos/seed/a/900/700'), 'https://picsum.photos/seed/a/900/700');
assert.equal(imageCacheKey('https://x/y.jpg#frag'), 'https://x/y.jpg');
assert.notEqual(imageCacheKey('https://x/a.jpg?t=1'), imageCacheKey('https://x/b.jpg?t=1'), 'different files never share a key');

console.log('imageLoading: all checks passed');
