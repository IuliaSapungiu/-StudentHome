/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMockPropertyRepository } from './mockRepository';
import { DEMO_OWNER_IDENTITY, DEMO_PROPERTIES } from './mockProperties';
import { isVerified } from './listing';
import { photoLimit } from '../features/plans/plans';
import { createDemoExchangeRateSource, createStaticExchangeRateSource } from '../features/currency/exchangeRate';
import { toRon } from '../features/currency/money';
import { describeAvailability } from './format';
import type { PropertyRecord } from './types';

const rate = createDemoExchangeRateSource().getRate();
const ron = (p: { rent: PropertyRecord['rent'] }) => toRon(p.rent, rate);

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
  assert.ok((await repo.search({ maxRentRon: 2000 })).every((p) => ron(p) <= 2000));
  assert.ok((await repo.search({ university: 'ASE' })).every((p) => p.nearestUniversity.name === 'ASE'));
  assert.ok((await repo.search({ types: ['studio'] })).every((p) => p.type === 'studio'));
  assert.ok((await repo.search({ bedrooms: [3] })).every((p) => p.bedrooms >= 3));
  assert.ok((await repo.search({ text: 'timisoara' })).length > 0);
  const asc = await repo.search({ sort: 'price_asc' });
  assert.deepEqual(asc.map(ron), [...asc.map(ron)].sort((a, b) => a - b));

  // Prices: original amount AND currency are kept together; the demo data mixes RON and EUR listings
  assert.ok(all.every((p) => (p.rent.currency === 'RON' || p.rent.currency === 'EUR') && p.rent.amount > 0));
  assert.ok(all.every((p) => p.deposit.currency === p.rent.currency));
  assert.ok(all.some((p) => p.rent.currency === 'EUR') && all.some((p) => p.rent.currency === 'RON'));
  // ...and they are filtered and sorted together in RON-equivalent terms
  const eurListing = all.find((p) => p.rent.currency === 'EUR')!;
  const limit = Math.ceil(ron(eurListing));
  assert.ok((await repo.search({ maxRentRon: limit })).some((p) => p.id === eurListing.id));
  assert.ok(!(await repo.search({ maxRentRon: limit - 1 })).some((p) => p.id === eurListing.id));
  const desc = await repo.search({ sort: 'price_desc' });
  assert.deepEqual(desc.map(ron), [...desc.map(ron)].sort((a, b) => b - a));
  // a different (demo) rate changes EUR listings only, and never touches the stored original amount
  const strong = createMockPropertyRepository(DEMO_PROPERTIES, DEMO_OWNER_IDENTITY, undefined, createStaticExchangeRateSource({ eurToRon: 10, effectiveDate: '2026-10-01', origin: 'demo' }));
  assert.ok(!(await strong.search({ maxRentRon: limit })).some((p) => p.id === eurListing.id));
  assert.equal((await strong.getById(eurListing.id))?.rent.amount, eurListing.rent.amount);

  // Bathrooms: min and max work together ("exactly 1")
  assert.ok((await repo.search({ minBathrooms: 1, maxBathrooms: 1 })).every((p) => p.bathrooms === 1));
  assert.ok((await repo.search({ minBathrooms: 2 })).every((p) => p.bathrooms >= 2));

  // Read model: provider summary for every listing
  assert.ok(all.every((p) => p.owner.displayName.length > 0 && p.owner.providerType));

  // Map coordinates: fictional, approximate (<= 3 decimals ~ 100 m) and inside the listing's city
  const BOX: Record<string, [number, number, number, number]> = {
    București: [44.33, 44.55, 25.95, 26.25],
    Bucharest: [44.33, 44.55, 25.95, 26.25],
    'Cluj-Napoca': [46.7, 46.83, 23.5, 23.7],
    Iași: [47.1, 47.22, 27.5, 27.65],
    Timișoara: [45.7, 45.8, 21.15, 21.3],
  };
  for (const p of all) {
    assert.ok(p.approxLocation, `${p.id} has an approximate location`);
    const { latitude: lat, longitude: lng } = p.approxLocation!;
    const box = BOX[p.city];
    assert.ok(box, `${p.id}: unknown city ${p.city}`);
    assert.ok(lat >= box[0] && lat <= box[1] && lng >= box[2] && lng <= box[3], `${p.id} is outside ${p.city}`);
    for (const v of [lat, lng]) assert.ok(Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, `${p.id} coordinates are more precise than ~100 m`);
  }

  // Availability wording tolerates dates already in the past
  assert.equal(describeAvailability('2026-10-15', '2026-10-21'), 'Available now');
  assert.equal(describeAvailability('2026-10-21', '2026-10-21'), 'Available now');
  assert.equal(describeAvailability('2026-11-01', '2026-10-21'), 'Available from 1 Nov 2026');

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
