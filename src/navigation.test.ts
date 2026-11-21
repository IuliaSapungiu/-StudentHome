/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for the Filters history bug. Filters is a screen pushed OVER the tabs. "Show N homes" used
// `router.navigate('/search')`, and since Expo Router 4 `navigate` is an alias of `push`: it stacked a second Search on top
// of Filters, so Filters stayed in the history and a back swipe reopened it (sometimes needing two swipes).
// The fix is `router.dismissTo('/search')`, which closes Filters and returns to the Search tab underneath.
// This test cannot drive the real navigator (the test setup has no React Native runtime), so it checks the source of the
// one action. The behaviour itself must be confirmed on a device: see the manual steps in the final report.

const filters = readFileSync(join(__dirname, 'app', 'filters.tsx'), 'utf8');
const code = filters.replace(/\/\/.*$/gm, ''); // ignore comments

assert.ok(/router\.dismissTo\(\s*['"]\/search['"]\s*\)/.test(code), 'Show N homes returns to Search with dismissTo');
assert.ok(!/router\.(navigate|push)\(\s*['"]\/search/.test(code), 'Filters must not push or navigate to Search (that leaves Filters in the history)');
assert.ok(!/router\.replace\(/.test(code), 'and must not replace itself with another screen');

// the filters are stored BEFORE the screen closes, so closing it loses nothing
const apply = code.slice(code.indexOf('dismissTo') - 700, code.indexOf('dismissTo'));
assert.ok(/setState\(|apply|setFilters|commit/i.test(apply), 'the draft is applied to the shared search state before the screen is dismissed');

// Filters is a ROOT stack route (src/app/filters.tsx, outside the (student) tab group) and the root layout is a Stack: that is
// why it sits above the tabs and why `navigate` would add Search on top of it instead of returning to the tabs.
const layout = readFileSync(join(__dirname, 'app', '_layout.tsx'), 'utf8');
assert.ok(/<Stack\b/.test(layout), 'the root layout is a Stack');

// Home opens Filters with push as well, so the same dismissTo serves both entry points
const home = readFileSync(join(__dirname, 'app', '(student)', 'index.tsx'), 'utf8') + readFileSync(join(__dirname, 'app', '(student)', 'search.tsx'), 'utf8');
assert.ok(/router\.push\(\s*['"]\/filters['"]/.test(home), 'Filters is opened with push from Home and Search');

console.log('navigation: all checks passed');
