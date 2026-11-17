/// <reference types="node" />
import assert from 'node:assert/strict';
import { consumeFocus, focusActionOnArrival, initialSearchRequests, onPresetApplied } from './searchRequests';
import { isHorizontalSwipe, shouldOpenAfterRelease, dragOffset } from '../../lib/swipe';

// ---- keyboard: only an explicit request from Home's search bar opens it, once
let r = initialSearchRequests;
assert.equal(focusActionOnArrival(r), 'dismiss', 'arriving at Search normally leaves the keyboard closed');
r = onPresetApplied(r, { focus: true }); // "Find your home" search bar
assert.equal(focusActionOnArrival(r), 'focus', 'the explicit request opens it');
r = consumeFocus(r); // Search acted on it
assert.equal(focusActionOnArrival(r), 'dismiss', 'it is used up: coming back from Filters or toggling map mode cannot re-open the keyboard');
assert.equal(consumeFocus(r), r, 'consuming again changes nothing');
// the scenario that reopened the keyboard: an earlier request happened, then Search is mounted again later
let later = consumeFocus(onPresetApplied(initialSearchRequests, { focus: true }));
for (let i = 0; i < 3; i++) assert.equal(focusActionOnArrival(later), 'dismiss', `re-mount ${i + 1}`);
// applying filters touches neither the focus request nor the scroll token (filters are not a preset)
const afterFilters = { ...later };
assert.deepEqual(afterFilters, later);
// a preset WITHOUT focus (a popular city) never asks for the keyboard, and replaces an old unused request
assert.equal(onPresetApplied({ focusRequested: true, scrollResetToken: 4 }, {}).focusRequested, false);
assert.equal(onPresetApplied(initialSearchRequests).focusRequested, false);

// ---- scroll: a new preset search bumps the token (Search remounts its list at the top); nothing else does
let t = initialSearchRequests;
const t1 = onPresetApplied(t);
assert.equal(t1.scrollResetToken, 1);
const t2 = onPresetApplied(t1);
assert.equal(t2.scrollResetToken, 2, 'each new city search gets its own token, so the previous scroll position is never reused');
assert.equal(consumeFocus(t2).scrollResetToken, 2, 'consuming a focus request does not reset the scroll again');
assert.equal(onPresetApplied(t2, { focus: true }).scrollResetToken, 3);
// the token must differ between two consecutive city selections (the key that remounts the list)
assert.notEqual(`2-${t1.scrollResetToken}`, `2-${t2.scrollResetToken}`);

// ---- swipe gesture rules (shared by message, conversation and notification rows)
assert.equal(isHorizontalSwipe(30, 4), true, 'a clear sideways swipe starts');
assert.equal(isHorizontalSwipe(30, 40), false, 'a diagonal drag is left to scrolling');
assert.equal(isHorizontalSwipe(6, 0), false, 'tiny movement is a tap, not a swipe');
assert.equal(isHorizontalSwipe(-30, 2), true, 'swiping back to close counts too');
assert.equal(isHorizontalSwipe(2, 80), false, 'vertical scrolling is never taken over');
assert.equal(dragOffset(false, -50, 168), 0, 'a closed row cannot be pulled leftwards');
assert.equal(dragOffset(false, 60, 168), 60);
assert.equal(dragOffset(false, 900, 168), 184, 'overshoot is capped');
assert.equal(dragOffset(true, -60, 168), 108, 'an open row follows the finger back');
assert.equal(shouldOpenAfterRelease(false, 80, 0, 168), true, 'pulled past 40%');
assert.equal(shouldOpenAfterRelease(false, 40, 0, 168), false, 'not far enough');
assert.equal(shouldOpenAfterRelease(false, 20, 0.6, 168), true, 'a quick flick right opens');
assert.equal(shouldOpenAfterRelease(true, -10, -0.6, 168), false, 'a quick flick left closes');

console.log('searchRequests: all checks passed');
