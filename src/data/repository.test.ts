/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMockPropertyRepository } from './mockRepository';
import { DEMO_OWNER_IDENTITY, DEMO_PROPERTIES } from './mockProperties';
import { isVerified } from './listing';
import { photoLimit } from '../features/plans/plans';
import type { PropertyRecord } from './types';

(async () => {
  assert.ok(DEMO_PROPERTIES.length >= 8 && DEMO_PROPERTIES.length <= 12);
  assert.equal(new Set(DEMO_PROPERTIES.map((p) => p.id)).size, DEMO_PROPERTIES.length);
  for (const p of DEMO_PROPERTIES) {
    assert.equal(p.source, 'demo');
    assert.ok(p.planId, 'demo listing needs a plan');
    assert.ok(p.images.length <= photoLimit(p.planId!), `${p.id} exceeds its plan photo limit`);
  }

  const repo = createMockPropertyRepository();
  const all = await repo.search();
  assert.equal(all.length, DEMO_PROPERTIES.length);

  // "Verified landlord" follows the landlord's identity verification, never the plan
  for (const p of all) assert.equal(isVerified(p), DEMO_OWNER_IDENTITY[p.ownerId] === 'verified');
  assert.ok(all.some((p) => p.planId === 'basic' && isVerified(p)), 'a Basic listing can have a verified landlord');
  assert.ok(all.some((p) => p.planId === 'premium' && !isVerified(p)), 'a Premium listing can have an unverified landlord');
  const verifiedOnly = await repo.search({ verifiedOnly: true });
  assert.ok(verifiedOnly.length > 0 && verifiedOnly.every((p) => DEMO_OWNER_IDENTITY[p.ownerId] === 'verified'));
  // Only the identity of the owner is represented: pending / more-info owners are not verified
  assert.ok(all.filter((p) => ['pending', 'more_info_required'].includes(DEMO_OWNER_IDENTITY[p.ownerId])).every((p) => !isVerified(p)));
  // A repository fed different owner statuses changes the badge without touching listings or plans
  const flipped = createMockPropertyRepository(DEMO_PROPERTIES, { ...DEMO_OWNER_IDENTITY, 'demo-owner-3': 'verified' });
  assert.ok((await flipped.getById('demo-3'))?.landlordIdentityVerified === true);
  assert.ok((await repo.getById('demo-3'))?.landlordIdentityVerified === false);

  // Higher-ranking plans come first in "recommended"
  const rec = await repo.search();
  const firstBasic = rec.findIndex((p) => p.planId === 'basic');
  assert.ok(rec.slice(firstBasic).every((p) => p.planId === 'basic'));

  // Filters
  assert.ok((await repo.search({ city: 'iasi' })).every((p) => p.city === 'Iași')); // accent-insensitive
  assert.ok((await repo.search({ maxRentRon: 2000 })).every((p) => p.rentRon <= 2000));
  assert.ok((await repo.search({ university: 'ASE' })).every((p) => p.nearestUniversity.name === 'ASE'));
  assert.ok((await repo.search({ types: ['studio'] })).every((p) => p.type === 'studio'));
  assert.ok((await repo.search({ bedrooms: [3] })).every((p) => p.bedrooms >= 3));
  assert.ok((await repo.search({ text: 'timisoara' })).length > 0);
  const asc = await repo.search({ sort: 'price_asc' });
  assert.deepEqual(asc.map((p) => p.rentRon), [...asc.map((p) => p.rentRon)].sort((a, b) => a - b));

  // Lookups and cities
  assert.equal((await repo.getById('demo-1'))?.id, 'demo-1');
  assert.equal(await repo.getById('nope'), null);
  assert.equal((await repo.getByIds(['demo-1', 'demo-2', 'x'])).length, 2);
  const cities = await repo.getCities();
  assert.equal(cities.reduce((n, c) => n + c.homeCount, 0), DEMO_PROPERTIES.length);

  // Drafts and expired listings can never leak into the public feed
  const draft: PropertyRecord = { ...DEMO_PROPERTIES[0], id: 'user-1', source: 'user', status: 'draft', planId: null };
  const expired: PropertyRecord = { ...DEMO_PROPERTIES[1], id: 'user-2', source: 'user', status: 'expired' };
  const mixed = createMockPropertyRepository([...DEMO_PROPERTIES, draft, expired]);
  assert.equal((await mixed.search()).length, DEMO_PROPERTIES.length);
  assert.equal(await mixed.getById('user-1'), null);
  assert.equal((await mixed.getByIds(['user-1', 'user-2'])).length, 0);

  // Demo data off -> empty feed, not silent demo listings
  assert.equal((await createMockPropertyRepository([]).search()).length, 0);

  console.log('data: all checks passed');
})();
