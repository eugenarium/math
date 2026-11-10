// @ts-check
// Проверка ответов по типам задач (docs/ARCHITECTURE.md, раздел 7).
import { evalExpr, freeSymbols } from './mathx.js';
import { makeRng } from './rng.js';

/** Ввод числа: точка или запятая, дробь 3/4, типографский минус. Возвращает число или null. */
export function parseNumber(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t = String(s).trim().replace(/−/g, '-').replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  const frac = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(t);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

const flat = (a) => (Array.isArray(a) ? a.flat(Infinity) : [a]);

function sameNumbers(input, answer, tol) {
  const x = flat(input);
  const a = flat(answer);
  if (x.length !== a.length) return false;
  const eps = tol === 0 ? 1e-9 : tol;
  return a.every((ai, i) => Math.abs(x[i] - ai) <= eps * Math.max(1, Math.abs(ai)));
}

/** @param {any} inst @param {any} input */
function checkNum(inst, input) {
  const parsed = Array.isArray(input) ? input.flat(Infinity).map(parseNumber) : [parseNumber(input)];
  if (parsed.some((x) => x === null)) return { ok: false, error: 'Введи число, например 3, −2,5 или 3/4' };
  const nums = parsed;
  if (sameNumbers(nums, inst.a, inst.tol)) return { ok: true };
  for (const [id, v] of Object.entries(inst.diag ?? {})) {
    if (sameNumbers(nums, v, inst.tol)) return { ok: false, diag: id };
  }
  return { ok: false };
}

/** @param {any} inst @param {number[]} picked индексы показанных вариантов */
function checkMc(inst, picked) {
  const want = inst.options.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
  const got = [...picked].sort((a, b) => a - b);
  if (got.length === want.length && got.every((v, i) => v === want[i])) return { ok: true };
  const wrong = got.map((i) => inst.options[i]).find((o) => o && !o.ok && o.e);
  return wrong ? { ok: false, diag: wrong.e } : { ok: false };
}

const normalizeExpr = (s) =>
  String(s)
    .replace(/−/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([A-Za-z0-9.]+)/g, 'sqrt($1)')
    .replace(/,/g, '.');

function pointsFor(inst) {
  const rng = makeRng(inst.seed + 7);
  const [lo, hi] = inst.dom;
  return Array.from({ length: 40 }, () => lo + (hi - lo) * rng.next());
}

/** @param {any} inst @param {string} input */
function checkExpr(inst, input) {
  const src = normalizeExpr(input);
  if (!src.trim()) return { ok: false, error: 'Введи выражение' };
  let bad;
  try {
    bad = freeSymbols(src, inst.vars);
  } catch (e) {
    return { ok: false, error: 'Не разобрать выражение' };
  }
  if (bad.length) return { ok: false, error: 'Неизвестно: ' + bad.join(', ') };
  const varName = inst.vars[0];
  const sameAs = (target) => {
    const targetScope = { ...inst.scope };
    let n = 0;
    let base = null;
    let baseS = null;
    for (const x of pointsFor(inst)) {
      const sc = { ...targetScope, [varName]: x };
      let t;
      try {
        t = evalExpr(target, sc);
      } catch {
        continue; // точка вне области определения ответа — заменяем
      }
      if (typeof t !== 'number') return false;
      let s;
      try {
        s = evalExpr(src, { [varName]: x });
      } catch {
        return false;
      }
      if (typeof s !== 'number') return false;
      if (inst.konst) {
        if (base === null) {
          base = t;
          baseS = s;
        } else if (!close(s - baseS, t - base)) return false;
      } else if (!close(s, t)) return false;
      if (++n === 8) return true;
    }
    return n >= 3;
  };
  if (sameAs(inst.a)) return { ok: true };
  for (const [id, ex] of Object.entries(inst.diag ?? {})) if (sameAs(ex)) return { ok: false, diag: id };
  return { ok: false };
}
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Цель graph/sim: |состояние − цель| ≤ допуск для каждой переменной. */
export function checkGoal(inst, state) {
  return Object.entries(inst.goal).every(([name, [target, tol]]) => {
    const v = state?.[name];
    return typeof v === 'number' && Math.abs(v - target) <= tol;
  });
}

/**
 * Проверяет ответ.
 * num: строка или массив строк · mc: индексы · expr: строка · spot: номер строки (с 1)
 * graph: состояние виджета · sim: {runs, state, answer}
 * @param {any} inst @param {any} input
 * @returns {{ok: boolean, diag?: string, error?: string}}
 */
export function checkAnswer(inst, input) {
  switch (inst.k) {
    case 'num':
      return checkNum(inst, input);
    case 'mc':
      return checkMc(inst, input);
    case 'expr':
      return checkExpr(inst, input);
    case 'spot':
      return input === inst.badIndex ? { ok: true } : { ok: false };
    case 'graph':
      return { ok: checkGoal(inst, input) };
    case 'sim': {
      if ((input?.runs ?? 0) < inst.min) return { ok: false, error: `Проведи не меньше ${inst.min} опытов` };
      if (inst.a !== undefined) return { ok: sameNumbers([parseNumber(input.answer)], [inst.a], inst.tol) };
      return { ok: checkGoal(inst, input.state) };
    }
    default:
      return { ok: false, error: 'Тип задачи пока не поддержан' };
  }
}
