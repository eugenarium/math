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
          // ученик вводит выражение с числами, а не с именами переменных задачи
          const typed = inst.a.replace(/\b[A-Za-z]\w*\b/g, (n) => (n in inst.scope ? '(' + inst.scope[n] + ')' : n));
          assert.equal(checkAnswer(inst, typed).ok, true, where + ' ввод: ' + typed);
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
  const pr = { p1: { k: 'num' }, p2: { k: 'num', lv: 2 }, p3: { k: 'mc' }, p4: { k: 'sim', lv: 2 } };
  const h = (...a) => a.map(([pid, ok]) => ({ pid, ok }));
  assert.equal(isMastered(h(['p1', true], ['p3', true], ['p1', true], ['p2', true]), pr), false);
  assert.equal(isMastered(h(['p1', true], ['p3', true], ['p1', true], ['p3', true], ['p2', true]), pr), true);
  // шаблон уровня 2 ни разу не решён верно
  assert.equal(isMastered(h(['p1', true], ['p3', true], ['p1', true], ['p3', true], ['p1', true]), pr), false);
  assert.equal(currentLevel(h(['p1', true], ['p1', true]), pr), 2);
  assert.equal(currentLevel(h(['p1', true], ['p1', true], ['p2', false], ['p2', false]), pr), 1);
  // graph играбельна: шаблон p4 тоже нужно решить
  const pg = { ...pr, p4: { k: 'graph', lv: 2 } };
  const full = h(['p1', true], ['p3', true], ['p1', true], ['p3', true], ['p2', true]);
  assert.equal(isMastered(full, pg), false);
  assert.equal(isMastered([...full, { pid: 'p4', ok: true }], pg), true);
  const next = pickNext(h(['p1', true]), pr, 3);
  assert.ok(['p1', 'p2', 'p3'].includes(next.pid));
});

// ───── виджеты ─────
import { loaders } from '../widgets/index.js';
import { goalReachable } from '../widgets/kit.js';
import { sumRule, exactIntegral, compute as riemannOut } from '../widgets/riemann.js';

test('riemann: суммы на x^2 по отрезку [0, 2]', () => {
  const f = (x) => x * x;
  assert.ok(Math.abs(sumRule(f, 0, 2, 4, 'l') - 1.75) < 1e-12); // 0 + .25 + 1 + 2.25 = 3.5, ·0.5
  assert.ok(Math.abs(sumRule(f, 0, 2, 4, 'r') - 3.75) < 1e-12);
  assert.ok(Math.abs(sumRule(f, 0, 2, 4, 'm') - 2.625) < 1e-12);
  assert.ok(Math.abs(sumRule(f, 0, 2, 4, 't') - 2.75) < 1e-12);
  assert.ok(Math.abs(sumRule(f, 0, 2, 4, 's') - 8 / 3) < 1e-12);
  assert.ok(Math.abs(exactIntegral(f, 0, 2) - 8 / 3) < 1e-9);
  const out = riemannOut({ f: 'x^2', a: 0, b: 'b', n: [1, 60, 4] }, { b: 2 }, { n: 4, rule: 'l' });
  assert.ok(Math.abs(out.S - 1.75) < 1e-12 && Math.abs(out.err - (8 / 3 - 1.75)) < 1e-6);
});

test('graph: цель достижима во всех наборах (виджеты с модулем)', async () => {
  let checked = 0;
  for (const L of lessons) {
    for (const [pid, p] of Object.entries(L.pr)) {
      if (p.k !== 'graph' || !loaders[p.w.w] || p.w.drag) continue;
      const mod = await loaders[p.w.w]();
      for (let seed = 1; seed <= 40; seed++) {
        const inst = instantiate(p, seed, { lesson: L });
        assert.ok(goalReachable(mod, p.w, inst.scope, inst.goal), `${L.id}#${pid} seed=${seed}: цель недостижима`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 80, 'ожидались задачи graph c1.riem и c1.der, проверено ' + checked);
});

// ───── повторения ─────
import { INTERVALS, dayNumber, onMastered, grade, dueLessons, pickReview, buildSession, pickExam } from './srs.js';

test('srs: номер дня и интервалы', () => {
  assert.equal(dayNumber(new Date(2025, 0, 1)), 0);
  assert.equal(dayNumber(new Date(2025, 0, 2, 23, 59)), 1);
  assert.deepEqual(INTERVALS, [1, 3, 7, 16, 35, 80, 180]);
  assert.deepEqual(onMastered(100), [1, 0, 101, 0]);
  assert.deepEqual(onMastered(100, true), [1, 2, 107, 0]);
});

test('srs: оценка повторения 3/3, 2/3, 0–1 из 3', () => {
  assert.deepEqual(grade([1, 2, 0, 1], 3, 3, 50), [1, 3, 66, 2]); // 7 → 16 дней
  assert.deepEqual(grade([1, 2, 0, 1], 2, 3, 50), [1, 2, 57, 2]); // тот же
  assert.deepEqual(grade([1, 2, 0, 1], 1, 3, 50), [1, 0, 51, 2]); // два шага назад
  assert.deepEqual(grade([1, 6, 0, 1], 3, 3, 50), [1, 6, 230, 2]); // потолок
  assert.deepEqual(grade([1, 1, 0, 0], 0, 3, 50), [1, 0, 51, 1]); // нижняя граница
});

test('srs: уроки к повторению и сессия дня', () => {
  const L = { a: [1, 0, 10, 0], b: [1, 0, 12, 0], c: [1, 0, 20, 0], d: [0, 0, 5, 0], e: [2, 0, 1, 0] };
  assert.deepEqual(dueLessons(L, 12), ['a', 'b']);
  const lesson = (n) => ({ pr: Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i + 1}`, { k: i % 2 ? 'mc' : 'num', lv: i >= 2 ? 2 : 1 }])) });
  const lessons = { a: lesson(5), b: lesson(4) };
  const s = buildSession(L, lessons, {}, 12, 7);
  assert.equal(s.length, 6);
  assert.deepEqual(s, buildSession(L, lessons, {}, 12, 7), 'сессия детерминирована');
  for (const id of ['a', 'b']) {
    const mine = s.filter((x) => x.id === id);
    assert.equal(new Set(mine.map((x) => x.pid)).size, 3, 'шаблоны разные');
    assert.ok(mine.every((x) => (lessons[id].pr[x.pid].lv ?? 1) >= 2 || mine.filter((y) => lessons[id].pr[y.pid].lv >= 2).length >= 2));
  }
  // лимит: не больше 10 уроков
  const many = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`l${i}`, [1, 0, 1, 0]]));
  const ls = Object.fromEntries(Object.keys(many).map((k) => [k, lesson(4)]));
  assert.equal(new Set(buildSession(many, ls, {}, 5, 1).map((x) => x.id)).size, 10);
});

test('srs: шаблоны с ошибками выбираются чаще, экзамен берёт верхний уровень', () => {
  const pr = { p1: { k: 'num' }, p2: { k: 'num' }, p3: { k: 'num' }, p4: { k: 'num', lv: 2 } };
  const T = { 'x#p2': [0, 5] };
  for (let salt = 1; salt <= 20; salt++) {
    const pids = pickReview(pr, T, 'x', 2, salt).map((t) => t.pid);
    assert.ok(pids.includes('p4') && pids.includes('p2'), pids.join());
  }
  const ex = pickExam({ ...pr, p5: { k: 'num', lv: 2 } }, 3);
  assert.equal(ex.length, 4);
  assert.ok(ex.slice(0, 2).every((t) => ['p4', 'p5'].includes(t.pid)));
});

// ───── прогресс: экспорт, импорт, открытие уроков ─────
import { exportJson, importJson, isUnlocked, setLessonStatus, recordProblem, recordMisconception, fresh, load as loadProgress, save as saveProgress } from './store.js';

test('store: экспорт и импорт возвращают тот же прогресс', () => {
  const s = fresh();
  s.L['a.x'] = [1, 2, 700, 1];
  recordProblem(s, 'a.x', 'p1', true);
  recordProblem(s, 'a.x', 'p1', false);
  recordMisconception(s, 'a.x.err');
  assert.deepEqual(importJson(exportJson(s)), s);
  assert.deepEqual(s.T['a.x#p1'], [1, 1]);
  assert.equal(s.E['a.x.err'], 1);
});

test('store: неверный файл отклоняется, недостающие поля добавляются', () => {
  assert.throws(() => importJson('{"v":2}'), /формат/);
  assert.throws(() => importJson('не json'));
  const s = importJson('{"v":1,"L":{"a.x":[1,0,5,0]}}');
  assert.deepEqual(s.T, {});
  assert.deepEqual(s.set, {});
});

test('store: предпосылки и статус урока', () => {
  const s = fresh();
  assert.equal(isUnlocked(s, []), true);
  assert.equal(isUnlocked(s, ['a.x']), false);
  setLessonStatus(s, 'a.x', 0);
  assert.equal(isUnlocked(s, ['a.x']), false, 'начатый урок не открывает следующие');
  s.L['a.x'] = [1, 0, 3, 0];
  assert.equal(isUnlocked(s, ['a.x']), true);
  setLessonStatus(s, 'a.x', 2);
  assert.deepEqual(s.L['a.x'], [2, 0, 3, 0], 'статус меняется, интервал сохраняется');
});

test('store: без localStorage работает на пустом прогрессе', () => {
  assert.deepEqual(loadProgress(), fresh());
  assert.doesNotThrow(() => saveProgress(fresh()));
});
