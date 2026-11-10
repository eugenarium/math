// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';
import { fmtNum, render, sampleOne, instantiate, matTex } from './gen.js';
import { checkAnswer, parseNumber } from './check.js';
import { evalExpr, quoteVarArgs } from './mathx.js';
import { makeRng } from './rng.js';
import { isMastered, currentLevel, pickNext } from './mastery.js';

const M = '−';

test('fmtNum: 6 значащих цифр, типографский минус', () => {
  assert.equal(fmtNum(0.1 + 0.2), '0.3');
  assert.equal(fmtNum(-3), M + '3');
  assert.equal(fmtNum(1 / 3), '0.333333');
  assert.equal(fmtNum(-0), '0');
});

test('render: форматы шаблонов', () => {
  const s = { a: -3, b: 1, c: 2.5, M: [[1, 2], [3, 4]], u: [1, -1], p: 0.75, f: 'x^2/3' };
  assert.equal(render('@a', s), M + '3');
  assert.equal(render('@{a:s}', s), M + '3');
  assert.equal(render('@{c:s}', s), '+2.5');
  assert.equal(render('@{b:c}x', s), 'x');
  assert.equal(render('@{a:c}x', s), M + '3x');
  assert.equal(render('@{b:sc}', s), '+');
  assert.equal(render('@{a:n}', s), '(' + M + '3)');
  assert.equal(render('@{c:f2}', s), '2.50');
  assert.equal(render('@{p:fr}', s), '\\frac{3}{4}');
  assert.equal(render('@{u:m}', s), '\\begin{pmatrix} 1 \\\\ ' + M + '1 \\end{pmatrix}');
  assert.equal(render('@{a*b+1}', s), M + '2');
  assert.equal(render('$@a(x+h)^2$', s), '$' + M + '3(x+h)^2$');
  assert.match(render('@{f:tex}', s), /frac/);
  assert.equal(matTex([[1, 2], [3, 4]]), '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}');
});

test('генераторы переменных', () => {
  const rng = makeRng(1);
  for (let i = 0; i < 300; i++) {
    const a = sampleOne('-4..4 !0', {}, rng);
    assert.ok(a !== 0 && a >= -4 && a <= 4 && Number.isInteger(a));
    const p = sampleOne('0.1..0.9 /0.1', {}, rng);
    assert.ok(Math.abs(p * 10 - Math.round(p * 10)) < 1e-9 && p >= 0.1 && p <= 0.9);
    const U = sampleOne('umat 2 -1..2', {}, rng);
    assert.equal(Math.abs(U[0][0] * U[1][1] - U[0][1] * U[1][0]), 1);
    const U3 = sampleOne('umat 3 -3..3', {}, rng);
    assert.equal(Math.round(Math.abs(evalExpr('det(M)', { M: U3 }))), 1);
    const S = sampleOne('smat 3 -4..4', {}, rng);
    assert.equal(S[0][2], S[2][0]);
  }
  const d = sampleOne('data norm(50,10) 8 1', {}, rng);
  assert.equal(d.length, 8);
  assert.deepEqual(sampleOne([2, 3], {}, makeRng(5)) > 0, true);
  assert.deepEqual(sampleOne('=a*2', { a: 4 }, rng), 8);
});

test('D, at, integ над строковыми выражениями', () => {
  assert.equal(quoteVarArgs('at(D(f,x),x,3)'), 'at(D(f,"x"),"x",3)');
  assert.equal(evalExpr('at(D(f,x),x,3)', { f: 'x^2' }), 6);
  assert.ok(Math.abs(evalExpr('integ(f,x,0,1)', { f: 'x^2' }) - 1 / 3) < 1e-9);
});

test('parseNumber', () => {
  assert.equal(parseNumber('3,5'), 3.5);
  assert.equal(parseNumber('3/4'), 0.75);
  assert.equal(parseNumber('−2'), -2);
  assert.equal(parseNumber('abc'), null);
  assert.equal(parseNumber('1/0'), null);
});

// ───── прогон всех задач всех уроков: 200 наборов, как в линтере E3xx ─────
const lessons = [];
for (const dir of readdirSync('content/lessons')) {
  for (const f of readdirSync(`content/lessons/${dir}`)) {
    lessons.push(load(readFileSync(`content/lessons/${dir}/${f}`, 'utf8')));
  }
}

test('все задачи уроков: числа вычисляются, верный ответ принимается, диагностика отличается', () => {
  assert.ok(lessons.length >= 3);
  for (const L of lessons) {
    for (const [pid, p] of Object.entries(L.pr)) {
      for (let seed = 1; seed <= 200; seed++) {
        const where = `${L.id}#${pid} seed=${seed}`;
        let inst;
        try {
          inst = instantiate(p, seed, { lesson: L });
        } catch (e) {
          assert.fail(`${where}: ${e.message}`);
        }
        if (inst.k === 'num') {
          const input = Array.isArray(inst.a) ? inst.a.map((r) => (Array.isArray(r) ? r.map(String) : String(r))) : String(inst.a);
          assert.equal(checkAnswer(inst, input).ok, true, where + ': верный ответ отвергнут');
          for (const [eid, v] of Object.entries(inst.diag)) {
            const r = checkAnswer(inst, Array.isArray(v) ? v.map(String) : String(v));
            assert.equal(r.ok, false, `${where}: диагностика ${eid} совпала с верным ответом`);
            assert.equal(r.diag, eid, `${where}: диагностика ${eid} не распознана`);
          }
        } else if (inst.k === 'mc') {
          const right = inst.options.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
          assert.equal(checkAnswer(inst, right).ok, true, where);
          const texts = inst.options.map((o) => o.text);
          assert.equal(new Set(texts).size, texts.length, `${where}: одинаковые варианты`);
        } else if (inst.k === 'expr') {
          assert.equal(checkAnswer(inst, inst.a).ok, true, where);
        } else if (inst.k === 'spot') {
          assert.equal(checkAnswer(inst, inst.badIndex).ok, true, where);
          assert.equal(checkAnswer(inst, inst.badIndex === 1 ? 2 : 1).ok, false, where);
        }
      }
    }
  }
});

test('expr: эквивалентные выражения и константа первообразной', () => {
  const base = { k: 'expr', seed: 1, scope: { a: 3 }, vars: ['x'], dom: [-3, 3], diag: { 'x.y': 'a*x' } };
  const inst = { ...base, a: '2*a*x' };
  assert.equal(checkAnswer(inst, '6x').ok, true);
  assert.equal(checkAnswer(inst, 'x*3*2').ok, true);
  assert.deepEqual(checkAnswer(inst, '3x'), { ok: false, diag: 'x.y' });
  assert.match(checkAnswer(inst, 'q+1').error, /Неизвестно/);
  const prim = { ...base, a: 'x^2/2', konst: true, diag: {} };
  assert.equal(checkAnswer(prim, 'x^2/2+7').ok, true);
  assert.equal(checkAnswer(prim, 'x^2/2*2').ok, false);
});

test('mastery: критерий и уровни', () => {
  const pr = { p1: { k: 'num' }, p2: { k: 'num', lv: 2 }, p3: { k: 'mc' }, p4: { k: 'graph', lv: 2 } };
  const h = (...a) => a.map(([pid, ok]) => ({ pid, ok }));
  assert.equal(isMastered(h(['p1', true], ['p3', true], ['p1', true], ['p2', true]), pr), false);
  assert.equal(isMastered(h(['p1', true], ['p3', true], ['p1', true], ['p3', true], ['p2', true]), pr), true);
  // шаблон уровня 2 ни разу не решён верно
  assert.equal(isMastered(h(['p1', true], ['p3', true], ['p1', true], ['p3', true], ['p1', true]), pr), false);
  assert.equal(currentLevel(h(['p1', true], ['p1', true]), pr), 2);
  assert.equal(currentLevel(h(['p1', true], ['p1', true], ['p2', false], ['p2', false]), pr), 1);
  const next = pickNext(h(['p1', true]), pr, 3);
  assert.ok(['p1', 'p2', 'p3'].includes(next.pid));
});
