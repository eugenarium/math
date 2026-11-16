import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distToSegment, hitsStroke, compactPath, contentBottom, importNotes, emptyPage, PAGE_H0 } from './notes.js';

test('расстояние до отрезка: внутри, за концом, вырожденный отрезок', () => {
  assert.equal(distToSegment(5, 3, 0, 0, 10, 0), 3);
  assert.equal(distToSegment(13, 4, 0, 0, 10, 0), 5);
  assert.equal(distToSegment(3, 4, 0, 0, 0, 0), 5);
});

test('ластик задевает штрих между точками, а не только по вершинам', () => {
  const st = { c: 'k', w: 4, p: [0, 0, 100, 0] };
  assert.ok(hitsStroke(st, 50, 10, 9)); // 10 ≤ 9 + 2
  assert.ok(!hitsStroke(st, 50, 20, 9));
  assert.ok(hitsStroke({ c: 'k', w: 4, p: [5, 5] }, 8, 5, 2)); // точка
});

test('compactPath округляет и убирает повторы', () => {
  assert.deepEqual(compactPath([1.2, 2.8, 1.4, 3.1, 5, 6]), [1, 3, 5, 6]);
});

test('contentBottom и пустой лист', () => {
  assert.equal(contentBottom(emptyPage()), 0);
  assert.equal(contentBottom({ h: 10, s: [{ c: 'k', w: 4, p: [0, 10, 5, 90] }] }), 94);
});

test('importNotes отбрасывает мусор и ограничивает высоту', () => {
  const r = importNotes({
    a: { h: 99999, s: [{ c: 'k', w: 4, p: [0, 0, 1, 1] }, { c: 1, w: 4, p: [0, 0] }, { c: 'r', w: 4, p: [NaN, 0] }] },
    b: 5,
    c: { h: 5, s: [] },
  });
  assert.deepEqual(Object.keys(r).sort(), ['a', 'c']);
  assert.equal(r.a.s.length, 1);
  assert.equal(r.a.h, 12000);
  assert.equal(r.c.h, PAGE_H0);
  assert.deepEqual(importNotes(null), {});
});
