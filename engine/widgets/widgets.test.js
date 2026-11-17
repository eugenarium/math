import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as truth from './truth.js';
import * as chance from './chance.js';
import * as taylor from './taylor.js';
import * as limit from './limit.js';
import * as scatter from './scatter.js';
import * as bayes from './bayes.js';
import * as vec2 from './vec2.js';
import * as sample from './sample.js';

test('truth: де Морган — столбцы равны, импликация — три единицы', () => {
  assert.equal(truth.compute({ f: ['!(p & q)', '!p | !q'] }, {}, {}).eq, 1);
  assert.equal(truth.compute({ f: 'p -> q' }, {}, {}).ones, 3);
  assert.equal(truth.compute({ f: 'p | !p' }, {}, {}).taut, 1);
  assert.equal(truth.compute({ f: 'p -> q', fill: 1 }, {}, { bits: 13, set: 15 }).ok, 1);
  assert.equal(truth.compute({ f: 'p -> q', fill: 1 }, {}, { bits: 12, set: 15 }).ok, 0);
});

test('truth: приоритеты связок', () => {
  assert.equal(truth.compute({ f: ['p | q & r', 'p | (q & r)'] }, {}, {}).eq, 1);
  assert.equal(truth.compute({ f: ['p -> q -> r', 'p -> (q -> r)'] }, {}, {}).eq, 1);
});

test('chance: точные вероятности', () => {
  assert.ok(Math.abs(chance.exactP({ exp: 'dice', cfg: { n: 2 }, ev: 'sum == 7' }) - 1 / 6) < 1e-9);
  assert.ok(Math.abs(chance.exactP({ exp: 'coin', cfg: { n: 3 }, ev: 'heads >= 1' }) - 7 / 8) < 1e-9);
  assert.ok(Math.abs(chance.exactP({ exp: 'urn', cfg: { r: 3, b: 2, draw: 2 }, ev: 'red == 2' }) - 0.3) < 1e-9);
});

test('taylor: коэффициенты exp, sin, ln(1+x)', () => {
  assert.deepEqual(taylor.coeffs('exp(x)', 0, 3).map((x) => Number(x.toFixed(6))), [1, 1, 0.5, 0.166667]);
  assert.equal(Number(taylor.coeffs('sin(x)', 0, 3)[3].toFixed(6)), -0.166667);
  assert.equal(Number(taylor.coeffs('ln(1+x)', 0, 2)[2].toFixed(6)), -0.5);
});

test('limit: ε–N и ε–δ', () => {
  assert.equal(limit.compute({ mode: 'seq', an: '1/n', L: 0 }, {}, { eps: 0.1, N: 10 }).ok, 1);
  assert.equal(limit.compute({ mode: 'seq', an: '1/n', L: 0 }, {}, { eps: 0.1, N: 5 }).ok, 0);
  assert.equal(limit.compute({ mode: 'ed', f: '2*x+1', a: 1, L: 3 }, {}, { eps: 0.2, delta: 0.1 }).ok, 1);
  assert.equal(limit.compute({ mode: 'ed', f: '2*x+1', a: 1, L: 3 }, {}, { eps: 0.2, delta: 0.2 }).ok, 0);
});

test('scatter: корреляция облака близка к заданной, прямая — МНК', () => {
  const o = scatter.compute({ gen: { n: 400, r: 0.8, seed: 7 } }, {}, {});
  assert.ok(Math.abs(o.r - 0.8) < 0.08);
  assert.ok(o.sse > 0 && o.k === o.ky);
  const hand = scatter.compute({ pts: [[0, 0], [1, 1], [2, 2]], fit: 'hand' }, {}, { k: 1, b: 0 });
  assert.equal(hand.sse, 0);
});

test('bayes: 1 % болеют, точность 90 % — апостериорная около 8 %', () => {
  assert.ok(Math.abs(bayes.compute({}, {}, { prior: 0.01, sens: 0.9, spec: 0.9 }).post - 1 / 12) < 1e-4);
});

test('vec2: ортогональные векторы', () => {
  const o = vec2.compute({}, {}, { 'a.x': 3, 'a.y': 4, 'b.x': 4, 'b.y': -3 });
  assert.equal(o.dot, 0);
  assert.equal(o.angle, 90);
});

test('sample: статистики и моменты совокупности', () => {
  assert.equal(sample.statOf('median', [1, 5, 3]), 3);
  assert.equal(sample.population({ d: 'dice' }).mean, 3.5);
});
