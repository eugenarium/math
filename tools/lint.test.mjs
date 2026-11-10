import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext, lintLesson, lintCourse, lintAll } from './lint.mjs';

const { data, ctx } = await makeContext();
const clone = (o) => JSON.parse(JSON.stringify(o));
const codes = (L, card = data.cards[L.id]) => lintLesson(L, card, ctx).map((r) => r.code);
const base = () => clone(data.lessons['c1.der']);

test('реальные уроки проходят без ошибок E', async () => {
  const { errors, lessons } = await lintAll();
  assert.deepEqual(errors, []);
  assert.ok(lessons >= 4);
});

const cases = [
  ['E203', (L) => void (L.def[0] = { g: 'nope' })],
  ['E204', (L) => void L.err.push('c1.der.valu')],
  ['E205', (L) => void (L.ex[0] = { x: 'p9' })],
  ['E207', (L) => void delete L.pr.p5],
  ['E301', (L) => void (L.pr.p1.q = 'Найди @zzz для $f(x)$ при $x=@x0$.')],
  ['E302', (L) => void (L.pr.p1.c = ['a > 100'])],
  ['E303', (L) => void (L.pr.p1.a = '1/(x0-x0)')],
  ['E304', (L) => void (L.pr.p1 = { k: 'mc', q: 'Что верно?', a: 'Один', x: ['Один', 'Два', 'Три'] })],
  ['E305', (L) => void (L.pr.p1.q = 'Найди $\\frac{1}{$ при $x=@x0$.')],
  ['E306', (L) => void (L.pr.p1.dom = [0, 1])],
  ['E308', (L) => void (L.pr.p3.a = '2*zz*x')],
  ['E309', (L) => void delete L.pr.p2.sol],
  ['E310', (L) => void (L.pr.p4.goal = { zzz: [1, 1] })],
  ['E401', (L) => void (L.int[1] = { w: 'nosuch' })],
  ['E402', (L) => void (L.int[1].bogus = 1)],
  ['E403', (L) => void (L.int[1] = { w: 'riemann', f: 'x', a: 0, b: 1 })],
];
for (const [code, mutate] of cases) {
  test(`${code} срабатывает на испорченном уроке`, () => {
    const L = base();
    mutate(L);
    assert.ok(codes(L).includes(code), `${code} не найден: ${codes(L).join(',')}`);
  });
}

test('W-предупреждения: нет fast, нет уровня 2, стоп-слово, длинная формула', () => {
  const L = base();
  for (const p of Object.values(L.pr)) {
    delete p.fast;
    delete p.lv;
  }
  L.int[0] = 'Очевидно, что $' + 'x+'.repeat(40) + 'x$ растёт.';
  const c = codes(L);
  for (const w of ['W505', 'W506', 'W507', 'W502']) assert.ok(c.includes(w), w);
});

test('карта курса: E201, E202, E206', () => {
  const idx = [
    { id: 'a.x', pre: ['b.x'], p: 'core' },
    { id: 'b.x', pre: ['a.x'], p: 'core' },
    { id: 'c.x', pre: ['zzz.x'], p: 'core' },
    { id: 'd.x', pre: ['e.x'], p: 'core' },
    { id: 'e.x', pre: [], p: 'ext' },
  ];
  const c = lintCourse(idx).map((r) => r.code);
  for (const code of ['E201', 'E202', 'E206']) assert.ok(c.includes(code), code);
  assert.deepEqual(lintCourse(data.index).map((r) => `${r.code} ${r.id}`), []);
});
