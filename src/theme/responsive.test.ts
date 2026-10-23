/// <reference types="node" />
import assert from 'node:assert/strict';
import { breakpoints, getLayout } from './responsive';

const L = getLayout;

// Phones keep the phone layout in BOTH orientations (device class follows the shortest side)
const phones: [string, number, number][] = [
  ['iPhone SE', 375, 667],
  ['iPhone 15', 393, 852],
  ['iPhone 15 Pro Max', 430, 932],
  ['Pixel 8', 412, 915],
  ['small Android', 320, 640],
];
for (const [name, w, h] of phones) {
  assert.equal(L(w, h).deviceClass, 'phone', `${name} portrait`);
  assert.equal(L(h, w).deviceClass, 'phone', `${name} landscape is still a phone`);
  assert.equal(L(w, h).columns, 1, `${name} portrait: one column`);
  assert.ok(L(h, w).columns <= 2, `${name} landscape: never more than two columns`);
  assert.equal(L(w, h).isLandscape, false);
  assert.equal(L(h, w).isLandscape, true);
  assert.equal(L(h, w).gutter <= 24, true, 'phone gutters stay phone-sized in landscape');
}
assert.equal(L(667, 375).columns, 1, 'a short landscape phone (667 wide) keeps one column');
assert.equal(L(852, 393).columns, 2, 'a wide landscape phone gets two columns');
assert.equal(L(320, 640).isSmallPhone, true);
assert.equal(L(640, 320).isSmallPhone, true, 'compactness follows the short side in landscape too');
assert.equal(L(393, 852).isSmallPhone, false);

// Tablets are tablets in both orientations
const tablets: [string, number, number][] = [
  ['iPad mini', 744, 1133],
  ['iPad', 820, 1180],
  ['iPad Pro 12.9', 1024, 1366],
  ['Android tablet', 800, 1280],
];
for (const [name, w, h] of tablets) {
  assert.equal(L(w, h).deviceClass, 'tablet', `${name} portrait`);
  assert.equal(L(h, w).deviceClass, 'tablet', `${name} landscape`);
  assert.equal(L(w, h).columns, w >= breakpoints.largeTablet ? 3 : 2);
  assert.equal(L(h, w).columns, 3, `${name} landscape: three columns`);
  assert.equal(L(w, h).gutter, 32);
}

// A tablet in a narrow split-screen window is treated as a phone
assert.equal(L(400, 1000).deviceClass, 'phone');
assert.equal(L(400, 1000).columns, 1);

// Breakpoint edges
assert.equal(L(599, 599).deviceClass, 'phone');
assert.equal(L(600, 600).deviceClass, 'tablet');
assert.equal(L(699, 360).columns, 1);
assert.equal(L(700, 360).columns, 2);
assert.equal(L(899, 700).columns, 2);
assert.equal(L(900, 700).columns, 3);

// Height is optional (older callers): width alone behaves like before
assert.equal(L(390).deviceClass, 'phone');
assert.equal(L(768).deviceClass, 'tablet');

// Grid geometry never overflows the usable width and carousels stay phone-sized in landscape
for (const [w, h] of [...phones.flatMap(([, a, b]) => [[a, b], [b, a]] as const), ...tablets.flatMap(([, a, b]) => [[a, b], [b, a]] as const)]) {
  const l = L(w, h);
  const usable = Math.min(w, l.contentMaxWidth) - l.gutter * 2;
  assert.ok(l.gridItemWidth > 0);
  assert.ok(l.gridItemWidth * l.columns + l.gap * (l.columns - 1) <= usable, `${w}x${h} grid fits`);
  if (l.deviceClass === 'phone') assert.ok(l.carouselCardWidth >= 240 && l.carouselCardWidth <= 340);
}

console.log('responsive: all checks passed');
