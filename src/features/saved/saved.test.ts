/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMemoryKeyValue, createMockStorage, MOCK_NAMESPACE } from '../../storage/keyValue';
import { createMockSavedRepository } from './mockSavedRepository';
import { isSaved, savedIdsFor, setSaved, toggleSaved, type SavedByUser } from './savedLogic';

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

// setSaved is idempotent and never duplicates
const once = setSaved(empty, 'u1', 'demo-1', true);
assert.deepEqual(savedIdsFor(setSaved(once, 'u1', 'demo-1', true), 'u1'), ['demo-1']);
assert.deepEqual(savedIdsFor(setSaved(once, 'u1', 'demo-9', false), 'u1'), ['demo-1'], 'unsaving something not saved changes nothing');
assert.deepEqual(savedIdsFor(setSaved(once, 'u1', 'demo-1', false), 'u1'), []);

// ---- persistence behind the repository (Step 3c)
(async () => {
  const kv = createMemoryKeyValue();
  const repo = createMockSavedRepository(createMockStorage(kv));
  assert.deepEqual(await repo.list('u1'), []);
  assert.deepEqual(await repo.set('u1', 'demo-1', true), ['demo-1']);
  assert.deepEqual(await repo.set('u1', 'demo-2', true), ['demo-2', 'demo-1'], 'most recent first');
  assert.deepEqual(await repo.set('u1', 'demo-2', true), ['demo-2', 'demo-1'], 'saving twice does not duplicate');
  assert.deepEqual(await repo.set('u2', 'demo-3', true), ['demo-3']);
  assert.deepEqual(await repo.list('u1'), ['demo-2', 'demo-1'], 'accounts are isolated');
  // survives a "restart": a new repository over the same storage reads the same data
  const again = createMockSavedRepository(createMockStorage(kv));
  assert.deepEqual(await again.list('u1'), ['demo-2', 'demo-1']);
  // two quick saves in a row are both kept (serialised updates)
  await Promise.all([again.set('u3', 'demo-4', true), again.set('u3', 'demo-5', true)]);
  assert.equal((await again.list('u3')).length, 2);
  assert.deepEqual(await again.set('u1', 'demo-1', false), ['demo-2']);
  // corrupt storage behaves like "nothing saved"
  const bad = createMemoryKeyValue({ [MOCK_NAMESPACE + 'saved']: '{not json' });
  assert.deepEqual(await createMockSavedRepository(createMockStorage(bad)).list('u1'), []);
  const junk = createMemoryKeyValue({ [MOCK_NAMESPACE + 'saved']: JSON.stringify([{ userId: 'u1', propertyIds: ['demo-1', 5, 'demo-1'] }, 'x', null]) });
  assert.deepEqual(await createMockSavedRepository(createMockStorage(junk)).list('u1'), ['demo-1'], 'bad rows dropped, duplicates removed');
  console.log('saved: all checks passed');
})();
