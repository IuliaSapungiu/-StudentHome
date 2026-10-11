/// <reference types="node" />
import assert from 'node:assert/strict';
import { DEMO_ACCOUNTS } from '../../demo/demoAccounts';
import {
  becomeProvider, canSwitchModes, createUser, getModeAction, greetingFor, homeRouteFor, initialsFor,
  normalizeEmail, parseUser, sessionReducer, switchMode,
} from './sessionLogic';
import { validateEmail, validateLoginPassword, validateNewPassword } from './validation';

// Validation
assert.equal(validateEmail(''), 'Enter your email address.');
assert.ok(validateEmail('nope'));
assert.ok(validateEmail('a@b'));
assert.equal(validateEmail('  ana@example.com '), null);
assert.ok(validateNewPassword('short'));
assert.equal(validateNewPassword('12345678'), null);
assert.ok(validateLoginPassword(''));
assert.equal(validateLoginPassword('x'), null);
assert.equal(normalizeEmail('  Ana@Example.COM '), 'ana@example.com');

// Registration intents
const student = createUser('S@x.com', 'student', 'u1');
const landlord = createUser('l@x.com', 'provider', 'u2');
const both = createUser('b@x.com', 'both', 'u3');
assert.deepEqual([student.profiles.student, student.profiles.provider, student.activeMode], [true, null, 'student']);
assert.deepEqual([landlord.profiles.student, landlord.profiles.provider !== null, landlord.activeMode], [false, true, 'provider']);
assert.deepEqual([both.profiles.student, both.profiles.provider !== null, both.activeMode], [true, true, 'student']);
assert.equal(student.email, 's@x.com');
assert.equal('password' in student, false); // accounts never carry a password

// Mode rules
assert.deepEqual(getModeAction(student, 'student'), { kind: 'become_provider', label: 'Become a landlord' });
assert.equal(getModeAction(landlord, 'provider'), null); // provider-only: no redundant switch button
assert.deepEqual(getModeAction(both, 'student'), { kind: 'switch', to: 'provider', label: 'Switch to landlord mode' });
assert.deepEqual(getModeAction(both, 'provider'), { kind: 'switch', to: 'student', label: 'Switch to student mode' });
assert.equal(canSwitchModes(both), true);
assert.equal(canSwitchModes(student), false);
assert.equal(canSwitchModes(landlord), false);
assert.equal(switchMode(both, 'provider').activeMode, 'provider');
assert.equal(switchMode(student, 'provider').activeMode, 'student'); // unavailable mode is refused
assert.equal(switchMode(landlord, 'student').activeMode, 'provider');
const upgraded = becomeProvider(student);
assert.ok(upgraded.profiles.student && upgraded.profiles.provider && upgraded.activeMode === 'provider');
assert.equal(homeRouteFor('provider'), '/(landlord)');
assert.equal(homeRouteFor('student'), '/(student)');

// Greeting: guests vs authenticated users
assert.equal(greetingFor(null), 'Welcome to StudentHouse');
assert.equal(greetingFor(student), 'Welcome back');
assert.equal(greetingFor({ ...student, displayName: 'Ana Popescu' }), 'Welcome back, Ana');
assert.equal(initialsFor({ ...student, displayName: 'Ana Popescu' }), 'AP');
assert.equal(initialsFor(student), 'S');

// Stored data is validated, not trusted
assert.deepEqual(parseUser(JSON.parse(JSON.stringify(both))), both);
assert.equal(parseUser(null), null);
assert.equal(parseUser({ id: 'x' }), null);
assert.equal(parseUser({ ...student, activeMode: 'provider' }), null); // active mode must exist
assert.equal(parseUser({ ...student, profiles: { student: false, provider: null } }), null);
assert.equal(parseUser({ ...student, profiles: { student: 'yes', provider: null } }), null);

// Reducer
assert.deepEqual(sessionReducer({ status: 'loading' }, { type: 'guest' }), { status: 'guest' });
assert.deepEqual(sessionReducer({ status: 'guest' }, { type: 'signed_in', user: student }), { status: 'signed_in', user: student });
assert.deepEqual(sessionReducer({ status: 'signed_in', user: student }, { type: 'guest' }), { status: 'guest' });

// Demo accounts: flagged, parseable, and cover the three preview types
assert.deepEqual(DEMO_ACCOUNTS.map((a) => a.key), ['student', 'landlord', 'both']);
for (const a of DEMO_ACCOUNTS) {
  assert.equal(a.user.isDemo, true);
  assert.ok(parseUser(JSON.parse(JSON.stringify(a.user))));
}
assert.equal(getModeAction(DEMO_ACCOUNTS[1].user, 'provider'), null);

console.log('session: all checks passed');
