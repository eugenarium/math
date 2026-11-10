// @ts-check
// Генераторы переменных, ограничения, шаблоны текста и сборка экземпляра задачи.
import { evalExpr, toTex, math } from './mathx.js';
import { makeRng } from './rng.js';

const MINUS = '−';

// ───────── числа и форматы ─────────

/** 6 значащих цифр, без хвостовых нулей, типографский минус */
export function fmtNum(x) {
  if (typeof x !== 'number') return String(x);
  if (!Number.isFinite(x)) return String(x);
  let r = Number(x.toPrecision(6));
  if (Object.is(r, -0)) r = 0;
  let s = String(r);
  if (/e/i.test(s)) s = Math.abs(r) < 1 ? r.toFixed(10).replace(/0+$/, '') : r.toFixed(0);
  return s.replace('-', MINUS);
}

const abs = (x) => fmtNum(Math.abs(x));

/** TeX матрицы; вектор — столбцом */
export function matTex(M) {
  const rows = Array.isArray(M[0]) ? M : M.map((v) => [v]);
  const body = rows.map((r) => r.map((v) => fmtNum(v)).join(' & ')).join(' \\\\ ');
  return `\\begin{pmatrix} ${body} \\end{pmatrix}`;
}

function fracTex(x) {
  const f = math.fraction(x);
  const n = Number(f.s) * Number(f.n);
  const d = Number(f.d);
  if (d === 1) return fmtNum(n);
  const sign = n < 0 ? MINUS : '';
  return `${sign}\\frac{${Math.abs(n)}}{${d}}`;
}

/** @param {any} val @param {string} [fmt] */
export function formatValue(val, fmt) {
  if (Array.isArray(val)) return matTex(val);
  if (typeof val === 'string') return fmt === 'tex' ? toTex(val) : val;
  if (typeof val === 'boolean') return val ? 'да' : 'нет';
  switch (fmt) {
    case 's':
      return val >= 0 ? '+' + fmtNum(val) : MINUS + abs(val);
    case 'c':
      return val === 1 ? '' : val === -1 ? MINUS : fmtNum(val);
    case 'sc':
      return val === 1 ? '+' : val === -1 ? MINUS : val >= 0 ? '+' + fmtNum(val) : MINUS + abs(val);
    case 'n':
      return val < 0 ? `(${fmtNum(val)})` : fmtNum(val);
    case 'fr':
      return fracTex(val);
    case 'pc':
      return fmtNum(val * 100) + '\\,\\%';
    case 'm':
      return fmtNum(val);
    default:
      if (fmt && /^f\d+$/.test(fmt)) {
        const s = val.toFixed(Number(fmt.slice(1)));
        return (Object.is(Number(s), -0) ? s.replace('-', '') : s).replace('-', MINUS);
      }
      return fmtNum(val);
  }
}

// ───────── шаблоны ─────────

const TPL = /@\{([^}]*)\}|@([A-Za-z][A-Za-z0-9]*)/g;
const FMT = /^([\s\S]*):(s|c|sc|n|f\d+|fr|pc|m|tex)$/;

/** Подставляет @a и @{выражение:формат}. @param {string} text @param {Record<string, any>} scope */
export function render(text, scope) {
  return String(text).replace(TPL, (_all, braced, name) => {
    if (name !== undefined) return formatValue(evalExpr(name, scope));
    const m = FMT.exec(braced);
    const expr = m ? m[1] : braced;
    const fmt = m ? m[2] : undefined;
    if (fmt === 'tex') {
      const v = evalExpr(expr, scope);
      return formatValue(typeof v === 'string' ? v : expr, 'tex');
    }
    return formatValue(evalExpr(expr, scope), fmt);
  });
}

// ───────── генераторы ─────────

const RANGE = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)( !0)?(?: \/(\d+(?:\.\d+)?))?$/;

function decimals(x) {
  const s = String(x);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

/** все целочисленные 2×2 матрицы с det = ±1 и элементами в [lo, hi] */
const umat2Cache = new Map();
function umat2(lo, hi) {
  const key = lo + ',' + hi;
  let all = umat2Cache.get(key);
  if (!all) {
    all = [];
    for (let a = lo; a <= hi; a++)
      for (let b = lo; b <= hi; b++)
        for (let c = lo; c <= hi; c++)
          for (let d = lo; d <= hi; d++) if (Math.abs(a * d - b * c) === 1) all.push([[a, b], [c, d]]);
    umat2Cache.set(key, all);
  }
  return all;
}

function umatN(n, lo, hi, rng) {
  if (n === 2) return rng.pick(umat2(lo, hi)).map((r) => r.slice());
  for (let tries = 0; tries < 500; tries++) {
    const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let step = 0; step < 3 * n; step++) {
      const i = rng.int(0, n - 1);
      let j = rng.int(0, n - 1);
      if (i === j) j = (j + 1) % n;
      const c = rng.pick([-2, -1, 1, 2]);
      for (let k = 0; k < n; k++) M[i][k] += c * M[j][k];
    }
    if (M.flat().every((v) => v >= lo && v <= hi)) return M;
  }
  throw new Error(`umat ${n} ${lo}..${hi}: не удалось построить матрицу`);
}

function drawData(dist, args, n, dec, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let x;
    if (dist === 'norm') x = args[0] + args[1] * rng.normal();
    else if (dist === 'unif') x = args[0] + (args[1] - args[0]) * rng.next();
    else if (dist === 'exp') x = -Math.log(1 - rng.next()) / args[0];
    else if (dist === 'pois') {
      const L = Math.exp(-args[0]);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= rng.next();
      } while (p > L);
      x = k - 1;
    } else if (dist === 'binom') {
      x = 0;
      for (let t = 0; t < args[0]; t++) if (rng.next() < args[1]) x++;
    } else throw new Error('неизвестное распределение: ' + dist);
    out.push(Number(x.toFixed(dec)));
  }
  return out;
}

/**
 * Одно значение переменной по описанию генератора.
 * @param {any} spec @param {Record<string, any>} scope @param {ReturnType<typeof makeRng>} rng
 */
export function sampleOne(spec, scope, rng) {
  if (typeof spec === 'number') return spec;
  if (Array.isArray(spec)) return rng.pick(spec);
  if (typeof spec !== 'string') throw new Error('неверный генератор');
  if (spec.startsWith('=')) return evalExpr(spec.slice(1), scope);
  let m = RANGE.exec(spec);
  if (m) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    const step = m[4] ? Number(m[4]) : null;
    if (step) {
      const k = rng.int(0, Math.round((hi - lo) / step));
      return Number((lo + k * step).toFixed(Math.max(decimals(step), decimals(lo))));
    }
    for (let t = 0; t < 200; t++) {
      const x = rng.int(lo, hi);
      if (!(m[3] && x === 0)) return x;
    }
    throw new Error('диапазон состоит из одного нуля: ' + spec);
  }
  m = /^vec (\d+) (\S+)$/.exec(spec);
  if (m) return Array.from({ length: Number(m[1]) }, () => sampleOne(m[2], scope, rng));
  m = /^mat (\d+)x(\d+) (\S+)$/.exec(spec);
  if (m) return Array.from({ length: Number(m[1]) }, () => Array.from({ length: Number(m[2]) }, () => sampleOne(m[3], scope, rng)));
  m = /^umat (\d+) (-?\d+)\.\.(-?\d+)$/.exec(spec);
  if (m) return umatN(Number(m[1]), Number(m[2]), Number(m[3]), rng);
  m = /^smat (\d+) (\S+)$/.exec(spec);
  if (m) {
    const n = Number(m[1]);
    const S = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) S[i][j] = S[j][i] = sampleOne(m[2], scope, rng);
    return S;
  }
  m = /^data (\w+)\(([^)]*)\) (\d+)(?: (\d+))?$/.exec(spec);
  if (m) return drawData(m[1], m[2].split(',').map(Number), Number(m[3]), Number(m[4] ?? 0), rng);
  throw new Error('неизвестный генератор: ' + spec);
}

/** Набор переменных сверху вниз. */
export function sampleScope(v, rng) {
  /** @type {Record<string, any>} */
  const scope = {};
  for (const [name, spec] of Object.entries(v ?? {})) scope[name] = sampleOne(spec, scope, rng);
  return scope;
}

const truthy = (x) => x === true || (typeof x === 'number' && x !== 0);

/** Пересэмплирует набор, пока все ограничения c не станут истинными. Возвращает {scope, tries}. */
export function sampleWithConstraints(problem, rng, maxTries = 1000) {
  for (let tries = 1; tries <= maxTries; tries++) {
    const scope = sampleScope(problem.v, rng);
    if (!problem.c || problem.c.every((c) => truthy(evalExpr(c, scope)))) return { scope, tries };
  }
  throw new Error('ограничения c не выполняются за ' + maxTries + ' попыток');
}

// ───────── экземпляр задачи ─────────

export const PLAYABLE = new Set(['num', 'mc', 'expr', 'spot', 'graph']);

const renderAll = (arr, scope) => (arr ?? []).map((t) => (typeof t === 'string' ? render(t, scope) : t));

/**
 * Создаёт экземпляр задачи.
 * @param {any} p   запись задачи из урока
 * @param {number} seed
 * @param {{lesson?: any}} [ctx]
 */
export function instantiate(p, seed, ctx = {}) {
  const rng = makeRng(seed * 2654435761 + 12345);
  const { scope, tries } = sampleWithConstraints(p, rng);
  const inst = {
    tries,
    k: p.k,
    lv: p.lv ?? 1,
    seed,
    scope,
    fast: !!p.fast,
    q: p.q ? render(p.q, scope) : '',
    h: renderAll(p.h, scope),
    sol: renderAll(p.sol, scope),
  };
  switch (p.k) {
    case 'num': {
      const a = evalExpr(p.a, scope);
      const diag = {};
      for (const [id, ex] of Object.entries(p.e ?? {})) diag[id] = evalExpr(ex, scope);
      return { ...inst, a, tol: p.tol ?? 0.01, unit: p.u ?? '', diag };
    }
    case 'expr': {
      const diag = {};
      for (const [id, ex] of Object.entries(p.e ?? {})) diag[id] = String(ex);
      return { ...inst, a: String(p.a), vars: p.vars ?? ['x'], dom: p.dom ?? [-3, 3], konst: !!p.const, diag, rng: seed };
    }
    case 'mc': {
      const correct = [].concat(p.a).map((t) => render(t, scope));
      const wrong = Object.entries(p.e ?? {}).map(([id, t]) => ({ text: render(String(t), scope), e: id }));
      const extra = (p.x ?? []).map((t) => ({ text: render(t, scope) }));
      const want = Math.max(p.n ?? 4, correct.length + 1);
      const pool = [...wrong, ...rng.shuffle(extra)];
      const chosen = pool.slice(0, Math.max(0, want - correct.length));
      const options = rng.shuffle([...correct.map((text) => ({ text, ok: true })), ...chosen.map((o) => ({ ...o, ok: false }))]);
      return { ...inst, options, multi: correct.length > 1 };
    }
    case 'spot': {
      let steps = p.steps;
      if (!steps) {
        const src = ctx.lesson?.pr?.[p.from];
        if (!src) throw new Error('spot: нет задачи ' + p.from);
        steps = instantiate(src, seed, ctx).sol;
        const bad = rng.pick(p.bad);
        steps = steps.slice();
        steps[bad.i - 1] = bad.t;
        return { ...inst, steps, badIndex: bad.i, diagId: bad.e ?? null };
      }
      const bad = rng.pick(p.bad);
      const shown = renderAll(steps, scope);
      shown[bad.i - 1] = render(bad.t, scope);
      return { ...inst, steps: shown, badIndex: bad.i, diagId: bad.e ?? null };
    }
    case 'graph':
    case 'sim': {
      const goal = {};
      for (const [name, [target, tol]] of Object.entries(p.goal ?? {})) goal[name] = [evalExpr(target, scope), tol];
      return {
        ...inst,
        w: p.w, // выражения-параметры вычисляет виджет в области видимости scope
        goal,
        a: p.a !== undefined ? evalExpr(p.a, scope) : undefined,
        tol: p.tol ?? 0.1,
        min: p.min ?? 100,
      };
    }
    default:
      return { ...inst, unsupported: true };
  }
}
