/// <reference types="node" />
import assert from 'node:assert/strict';
import {
  DEMO_EUR_TO_RON,
  createDemoExchangeRateSource,
  createStaticExchangeRateSource,
  isValidRate,
  parseRateSetting,
} from './exchangeRate';
import { formatAmount, formatMoney, formatRate } from './format';
import { amountIn, convertMoney, displayAmountToRon, roundUnits, toDisplayPrice, toRon, ronToDisplayAmount } from './money';
import type { ExchangeRateSnapshot, Money } from './types';

const rate = createDemoExchangeRateSource().getRate();
const odd: ExchangeRateSnapshot = { eurToRon: 4.97, effectiveDate: '2026-10-01', origin: 'demo' };
const NBSP = '\u00a0';

// The demo rate is documented as a demo and is configurable; bad settings fall back safely
assert.equal(rate.eurToRon, DEMO_EUR_TO_RON);
assert.equal(rate.origin, 'demo');
assert.equal(createDemoExchangeRateSource(4.97).getRate().eurToRon, 4.97);
assert.equal(createDemoExchangeRateSource(NaN).getRate().eurToRon, DEMO_EUR_TO_RON);
assert.equal(createDemoExchangeRateSource(0).getRate().eurToRon, DEMO_EUR_TO_RON);
assert.equal(createDemoExchangeRateSource(500).getRate().eurToRon, DEMO_EUR_TO_RON);
assert.equal(parseRateSetting('4,97'), 4.97);
assert.equal(parseRateSetting(' 5 '), 5);
assert.equal(parseRateSetting('abc'), undefined);
assert.equal(parseRateSetting(''), undefined);
assert.equal(parseRateSetting(undefined), undefined);
assert.ok(isValidRate(5) && !isValidRate(-1) && !isValidRate(Infinity) && !isValidRate('5'));
// a source is just something that returns a snapshot, so a real provider can be swapped in later
assert.equal(createStaticExchangeRateSource(odd).getRate(), odd);

// Conversion in both directions
assert.equal(amountIn({ amount: 100, currency: 'EUR' }, 'RON', rate), 500);
assert.equal(amountIn({ amount: 500, currency: 'RON' }, 'EUR', rate), 100);
assert.equal(amountIn({ amount: 500, currency: 'RON' }, 'RON', rate), 500);
assert.equal(amountIn({ amount: 100, currency: 'EUR' }, 'EUR', odd), 100);
assert.deepEqual(convertMoney({ amount: 100, currency: 'EUR' }, 'RON', odd), { amount: 497, currency: 'RON' });
assert.equal(toRon({ amount: 330, currency: 'EUR' }, rate), 1650);
// round trip is stable
const there = convertMoney({ amount: 2500, currency: 'RON' }, 'EUR', odd);
assert.ok(Math.abs(convertMoney(there, 'RON', odd).amount - 2500) < 1e-9);

// Converting never changes the original amount (the input object is untouched)
const original: Money = Object.freeze({ amount: 330, currency: 'EUR' });
const display = toDisplayPrice(original, 'RON', rate);
assert.deepEqual(original, { amount: 330, currency: 'EUR' });
assert.deepEqual(display.original, { amount: 330, currency: 'EUR' });
assert.deepEqual(display.money, { amount: 1650, currency: 'RON' });
assert.equal(display.converted, true);
const same = toDisplayPrice({ amount: 2250, currency: 'RON' }, 'RON', rate);
assert.equal(same.converted, false);
assert.deepEqual(same.money, { amount: 2250, currency: 'RON' });
// rounding happens once, to whole units
assert.equal(toDisplayPrice({ amount: 2250, currency: 'RON' }, 'EUR', odd).money.amount, 453); // 452.7
assert.equal(roundUnits(2.5), 3);
assert.equal(roundUnits(452.717), 453);

// Formatting: Romanian style, symbol after the number, non-breaking space
assert.equal(formatAmount(2250), '2.250');
assert.equal(formatAmount(999), '999');
assert.equal(formatAmount(1234567), '1.234.567');
assert.equal(formatAmount(2249.6), '2.250');
assert.equal(formatMoney({ amount: 2250, currency: 'RON' }), `2.250${NBSP}lei`);
assert.equal(formatMoney({ amount: 450, currency: 'EUR' }), `450${NBSP}€`);
assert.equal(formatMoney({ amount: 1650, currency: 'RON' }, { approx: true }), `≈${NBSP}1.650${NBSP}lei`);
assert.equal(formatRate(rate), `1${NBSP}€ = 5,00${NBSP}lei`);
assert.equal(formatRate(odd), `1${NBSP}€ = 4,97${NBSP}lei`);

// Budget limits: typed in the display currency -> RON-equivalent (exact) -> shown again (rounded)
assert.equal(displayAmountToRon(500, 'EUR', rate), 2500);
assert.equal(displayAmountToRon(2500, 'RON', rate), 2500);
assert.equal(ronToDisplayAmount(2500, 'EUR', rate), 500);
assert.equal(ronToDisplayAmount(2500, 'EUR', odd), 503);
assert.equal(ronToDisplayAmount(2500, 'RON', odd), 2500);

console.log('currency: all checks passed');
