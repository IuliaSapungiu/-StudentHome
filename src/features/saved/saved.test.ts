/// <reference types="node" />
import assert from 'node:assert/strict';
import { isSaved, savedIdsFor, toggleSaved, type SavedByUser } from './savedLogic';

const empty: SavedByUser = {};
assert.deepEqual(savedIdsFor(empty, 'u1'), []);
assert.deepEqual(savedIdsFor(empty, null), []);
assert.equal(isSaved(empty, null, 'demo-1'), false);

const one = toggleSaved(empty, 'u1', 'demo-1');
assert.ok(isSaved(one, 'u1', 'demo-1'));
assert.deepEqual(empty, {}, 'the previous state is never mutated');
const two = toggleSaved(one, 'u1', 'demo-2');
assert.deepEqual(savedIdsFor(two, 'u1'), ['demo-2', 'demo-1'], 'most recently saved first');
const back = toggleSaved(two, 'u1', 'demo-1');
assert.ok(!isSaved(back, 'u1', 'demo-1') && isSaved(back, 'u1', 'demo-2'), 'toggling again removes it');
// users do not share saved homes
assert.equal(isSaved(two, 'u2', 'demo-1'), false);
assert.deepEqual(savedIdsFor(toggleSaved(two, 'u2', 'demo-3'), 'u1'), ['demo-2', 'demo-1']);
// the same state is read identically by every surface (list card, map preview, detail)
for (const surface of ['search', 'map', 'detail']) assert.ok(isSaved(two, 'u1', 'demo-2'), `${surface} sees the saved home`);

console.log('saved: all checks passed');
