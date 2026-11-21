/// <reference types="node" />
import assert from 'node:assert/strict';
import { imageCacheKey, initialImageState, isStaleImageEvent, MAX_AUTO_RETRIES, reduceImage, retryDelayMs, type ImageLoadEvent, type ImageLoadState } from './imageLoading';
import { canRenderPager, nextGalleryWidth, pageHeight, safeAspectRatio } from './galleryLayout';

// `loaded` / `failed` here come from the image that is currently loading, so they are tagged with the CURRENT source and
// nonce (as the real component does). Reports from OLDER loads are tested explicitly further down.
type Report = { type: 'loaded' } | { type: 'failed' };
const tag = (st: ImageLoadState, e: ImageLoadEvent | Report): ImageLoadEvent => {
  if (e.type === 'loaded') return { type: 'loaded', uri: st.uri, nonce: st.nonce };
  if (e.type === 'failed') return { type: 'failed', uri: st.uri, nonce: st.nonce };
  return e;
};
const run = (s: ImageLoadState, ...events: (ImageLoadEvent | Report)[]) => events.reduce<ImageLoadState>((st, e) => reduceImage(st, tag(st, e)), s);
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

// ---- stale reports: a late event from an OLDER load must never change the current photo
{
  const a = 'https://images.example/a.jpg';
  const b = 'https://images.example/b.jpg';
  // the same component switches from photo A to photo B; A's request fails AFTER the switch
  let st = initialImageState(a);
  st = reduceImage(st, { type: 'source', uri: b });
  const late = reduceImage(st, { type: 'failed', uri: a, nonce: 0 });
  assert.equal(late, st, "a late failure of photo A does not touch photo B");
  assert.equal(late.status, 'loading');
  assert.equal(late.attempts, 0, 'and does not use up one of its retries');
  assert.equal(reduceImage(st, { type: 'loaded', uri: a, nonce: 0 }).status, 'loading', "A's late success does not mark B as loaded either");
  assert.equal(reduceImage(st, { type: 'loaded', uri: b, nonce: 0 }).status, 'loaded', "B's own report counts");
  // an earlier retry of the SAME photo reports after the next retry has already started
  let r = initialImageState(a);
  r = run(r, { type: 'failed' }, { type: 'retry_timer' }); // retry started: nonce 1
  assert.equal(r.nonce, 1);
  assert.equal(reduceImage(r, { type: 'failed', uri: a, nonce: 0 }), r, 'a failure from the replaced attempt (nonce 0) is ignored');
  assert.equal(reduceImage(r, { type: 'loaded', uri: a, nonce: 0 }), r, 'and so is a success from it');
  assert.equal(run(r, { type: 'loaded' }).status, 'loaded', 'while the current attempt (nonce 1) still counts');
  // a failure for an unrelated image (another card) never reaches this state
  assert.equal(isStaleImageEvent(r, { type: 'failed', uri: 'https://images.example/other.jpg', nonce: 1 }), true);
  assert.equal(isStaleImageEvent(r, { type: 'failed', uri: a, nonce: 1 }), false);
  assert.equal(isStaleImageEvent(r, { type: 'retry_timer' }), false, 'timer and source events are never stale');
  // no photo: any report is stale
  assert.equal(isStaleImageEvent(initialImageState(null), { type: 'loaded', uri: a, nonce: 0 }), true);
}

// ---- gallery layout guard: the photo area can never collapse to nothing
assert.equal(safeAspectRatio(1.35), 1.35);
for (const bad of [0, -1, NaN, Infinity, undefined]) assert.equal(safeAspectRatio(bad as number | undefined), 1.4, `a bad ratio (${String(bad)}) falls back instead of collapsing the box`);
assert.equal(nextGalleryWidth(0, 390.4), 390, 'the first positive measurement is taken (rounded)');
assert.equal(nextGalleryWidth(390, 0), 390, 'a measurement of 0 is ignored: the gallery keeps its width');
assert.equal(nextGalleryWidth(0, 0), 0, 'no measurement yet stays unmeasured');
assert.equal(nextGalleryWidth(390, -5), 390);
assert.equal(nextGalleryWidth(390, NaN), 390);
assert.equal(nextGalleryWidth(390, 390.2), 390, 'the same width is not a change');
assert.equal(nextGalleryWidth(390, 844), 844, 'a real change (rotation) is taken');
assert.equal(canRenderPager(0), false, 'with no width the pager is not built: the first photo is shown on its own instead');
assert.equal(canRenderPager(390), true);
assert.equal(canRenderPager(NaN), false);
assert.equal(pageHeight(0, 1.35), 0);
assert.equal(Math.round(pageHeight(400, 1.25)), 320);
assert.ok(pageHeight(400, 0) > 0, 'even a bad ratio gives a visible page height');

console.log('imageLoading: all checks passed');
