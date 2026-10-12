/// <reference types="node" />
import assert from 'node:assert/strict';
import { isCuiFormatValid, normalizeCui, normalizeOnrc, normalizePhone, parsePhone, validateCui, validateFullName, validateOnrc, validatePhone, validateWebsite } from './index';

// ---- Phone: Romanian mobile + international, FORMAT only
for (const input of ['0712 345 678', '0712345678', '+40 712 345 678', '+40712345678', '0040 712 345 678', '(0712) 345-678']) {
  assert.equal(normalizePhone(input), '+40712345678', input);
}
assert.equal(parsePhone('0712345678').ok && (parsePhone('0712345678') as { kind: string }).kind, 'ro_mobile');
assert.equal(normalizePhone('+44 7911 123456'), '+447911123456');
assert.equal(normalizePhone('+1 415 555 2671'), '+14155552671');
assert.equal(normalizePhone('0044 7911 123456'), '+447911123456');
assert.equal((parsePhone('+447911123456') as { kind: string }).kind, 'international');
const phoneErrors: [string, string][] = [
  ['', 'empty'], ['abc', 'invalid_characters'], ['12345678', 'missing_country_code'],
  ['021 123 4567', 'ro_not_mobile'], ['+40 212 345 678', 'ro_not_mobile'], ['+40 7123', 'invalid_length'],
  ['+1', 'invalid_length'], ['+0123456789', 'invalid_length'], ['+44 12345678901234567', 'invalid_length'],
];
for (const [input, reason] of phoneErrors) {
  const r = parsePhone(input);
  assert.equal(r.ok, false, input);
  assert.equal(!r.ok && r.reason, reason, input);
  assert.ok(validatePhone(input), input);
}
assert.equal(validatePhone('0712345678'), null);

// ---- CUI/CIF: checksum (values computed independently of the implementation)
for (const ok of ['12345674', '123456789', '43', '999999991', '312345670', 'RO12345674', 'ro 12345674', ' RO 12 345 674 ']) {
  assert.equal(isCuiFormatValid(ok), true, ok);
  assert.equal(validateCui(ok), null, ok);
}
for (const bad of ['12345675', '123456780', '1', '12345678901', 'ABC123', '', '12.345.674', 'RO']) {
  assert.equal(isCuiFormatValid(bad), false, bad);
  assert.ok(validateCui(bad), bad);
}
assert.equal(normalizeCui('ro 12345674'), '12345674');

// ---- ONRC (classic format)
assert.equal(normalizeOnrc('J40/1234/2020'), 'J40/1234/2020');
assert.equal(normalizeOnrc('j 40 / 1234 / 2020'), 'J40/1234/2020');
assert.equal(normalizeOnrc('F3/12/2015'), 'F03/12/2015');
assert.equal(normalizeOnrc('C52/7/1999'), 'C52/7/1999');
for (const bad of ['X40/1234/2020', 'J41/1234/2020', 'J00/1/2020', 'J40/0/2020', 'J40/1234/1989', 'J40/1234/20', 'J40-1234-2020', '']) {
  assert.equal(normalizeOnrc(bad), null, bad);
  assert.ok(validateOnrc(bad), bad);
}
assert.equal(normalizeOnrc('J40/1234/2030', 2026), null); // a registration year in the future
assert.equal(validateOnrc('J40/1234/2020'), null);

// ---- Person / website
assert.ok(validateFullName(''));
assert.ok(validateFullName('Al'));
assert.ok(validateFullName('123456'));
assert.equal(validateFullName('Ana Popescu'), null);
assert.equal(validateFullName('Ștefan Văduva'), null);
assert.equal(validateWebsite(''), null); // optional
assert.equal(validateWebsite('www.example.ro'), null);
assert.equal(validateWebsite('https://agency.example.com/about'), null);
assert.ok(validateWebsite('not a site'));

console.log('validation: all checks passed');
