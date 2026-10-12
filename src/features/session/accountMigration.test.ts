/// <reference types="node" />
import assert from 'node:assert/strict';
import { createMemoryKeyValue, createMockStorage, MOCK_NAMESPACE } from '../../storage/keyValue';
import { createMockAccountRepository } from './mockAccountRepository';
import { createUser, fullNameOf, getModeAction } from './sessionLogic';

// Accounts exactly as Step 2 wrote them (no phone, terms, or fullName), plus corrupt and inconsistent records.
const STEP2_ACCOUNTS = [
  { id: 'mock-abc', email: 'old@x.com', profiles: { student: true, provider: null }, activeMode: 'student' },
  { id: 'mock-def', email: 'demo.both@example.com', displayName: 'Ana Popescu', isDemo: true, profiles: { student: true, provider: { onboardingComplete: false } }, activeMode: 'provider' },
  { id: 'bad', email: 'x' },
  { id: 'mock-ghi', email: 'weird@x.com', profiles: { student: true, provider: null }, activeMode: 'provider' },
  { id: 'mock-jkl', email: 'landlord@x.com', profiles: { student: false, provider: { onboardingComplete: false } }, activeMode: 'provider' },
  { id: 'mock-none', email: 'empty@x.com', profiles: { student: false, provider: null }, activeMode: 'student' },
];

(async () => {
  const kv = createMemoryKeyValue({
    [MOCK_NAMESPACE + 'accounts']: JSON.stringify(STEP2_ACCOUNTS),
    [MOCK_NAMESPACE + 'session']: JSON.stringify('mock-abc'),
  });
  const repo = createMockAccountRepository(createMockStorage(kv));

  const accounts = await repo.list();
  assert.deepEqual(accounts.map((a) => a.id).sort(), ['mock-abc', 'mock-def', 'mock-ghi', 'mock-jkl']); // corrupt / profile-less records dropped

  const old = accounts.find((a) => a.id === 'mock-abc')!;
  assert.deepEqual([old.email, old.phone, old.termsAcceptedAt, old.termsVersion, old.activeMode], ['old@x.com', null, null, null, 'student']);
  assert.deepEqual(old.profiles, { student: true, provider: null });

  const demo = accounts.find((a) => a.id === 'mock-def')!;
  assert.equal(fullNameOf(demo), 'Ana Popescu'); // legacy displayName still shown
  assert.equal(demo.isDemo, true);
  assert.equal(demo.activeMode, 'provider'); // valid stored mode kept

  assert.equal(accounts.find((a) => a.id === 'mock-ghi')!.activeMode, 'student'); // invalid mode repaired, account kept
  assert.equal(accounts.find((a) => a.id === 'mock-jkl')!.activeMode, 'provider');

  // The session pointer from Step 2 still works
  assert.equal(await repo.getSessionUserId(), 'mock-abc');

  // Mode rules still hold for migrated accounts
  assert.equal(getModeAction(old, 'student')?.kind, 'become_provider');
  assert.equal(getModeAction(accounts.find((a) => a.id === 'mock-jkl')!, 'provider'), null);

  // Saving upgrades in place, keeps others, and normalises the mode
  const upgraded = await repo.save({ ...old, fullName: 'Old User', phone: '+40712345678' });
  assert.equal(upgraded.phone, '+40712345678');
  const after = await repo.list();
  assert.equal(after.length, 4);
  assert.equal(after.find((a) => a.id === 'mock-abc')!.fullName, 'Old User');
  const forced = await repo.save({ ...old, activeMode: 'provider' }); // saving an impossible mode is repaired
  assert.equal(forced.activeMode, 'student');

  // New accounts coexist with migrated ones; the stored shape never contains a password
  const fresh = await repo.save(createUser('new@x.com', 'both', 'new-1', { fullName: 'New User', phone: '+447911123456', termsAcceptedAt: '2026-10-12T10:00:00.000Z', termsVersion: 'demo-0' }));
  assert.equal((await repo.list()).length, 5);
  assert.equal(JSON.stringify(kv.dump()).toLowerCase().includes('password'), false);
  assert.equal(fresh.activeMode, 'student');

  // Sign-out and cleanup
  await repo.setSessionUserId(null);
  assert.equal(await repo.getSessionUserId(), null);
  await repo.replaceAll((await repo.list()).filter((a) => !a.isDemo)); // what the provider does when demo accounts are disabled
  assert.equal((await repo.list()).some((a) => a.isDemo), false);

  // Unreadable storage behaves like an empty one
  const broken = createMockAccountRepository(createMockStorage(createMemoryKeyValue({ [MOCK_NAMESPACE + 'accounts']: '{not json', [MOCK_NAMESPACE + 'session']: '{' })));
  assert.deepEqual(await broken.list(), []);
  assert.equal(await broken.getSessionUserId(), null);

  console.log('accountMigration: all checks passed');
})();
