// @ts-check
// Ряды: члены последовательности и частичные суммы, слайдер числа членов.
import { createView, drawGrid, theme, label, dot } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr } from '../core/mathx.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'series',
  params: {
    an: ['E', null, 'член ряда, переменная n'],
    n0: ['N', 1, 'начальный номер'],
    N: ['range', [1, 100, 10], 'число членов: [min, max, начало]'],
    mode: ['enum', 'both', 'terms | sums | both'],
    cmp: ['E', null, 'ряд сравнения (члены от n)'],
    y: ['range', null, 'окно по y'],
  },
  out: ['N', 'S'],
};

export function controls(params) {
  const [mn, mx, st = mn] = params.N ?? [1, 100, 10];
  return [sliderSpec('N', [mn, mx, st, 1])];
}

export function initial(params) {
  return { N: controls(params)[0].start };
}

/** Частичная сумма первых N членов, начиная с n0. */
export function partial(an, n0, N, scope = {}) {
  let s = 0;
  for (let n = n0; n < n0 + N; n++) s += Number(evalExpr(an, { ...scope, n }));
  return s;
}

export function compute(params, scope, vars) {
  return { N: vars.N, S: Number(partial(params.an, params.n0 ?? 1, vars.N, scope).toFixed(8)) };
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const n0 = params.n0 ?? 1;
  const [, nmax] = params.N ?? [1, 100, 10];
  const mode = params.mode ?? 'both';
  const xr = [n0 - 0.5, n0 + Math.min(nmax, 60) + 0.5];
  const terms = Array.from({ length: Math.min(nmax, 60) }, (_, i) => Number(evalExpr(params.an, { ...scope, n: n0 + i })));
  const sums = [];
  let acc = 0;
  for (const t of terms) sums.push((acc += t));
  const vals = [...(mode === 'terms' ? terms : mode === 'sums' ? sums : [...terms, ...sums]), 0].filter(Number.isFinite);
  const yr = params.y ?? [Math.min(...vals) - 0.3, Math.max(...vals) + 0.3];
  const v = createView(el, { xr, yr, onResize: () => draw() });
  let vars = initial(params);
  const draw = () => {
    drawGrid(v, th);
    const o = compute(params, scope, vars);
    const N = Math.min(vars.N, terms.length);
    if (params.cmp) {
      for (let i = 0; i < N; i++) dot(v, n0 + i, Number(evalExpr(params.cmp, { ...scope, n: n0 + i })), th.muted, 3);
    }
    if (mode !== 'sums') for (let i = 0; i < N; i++) dot(v, n0 + i, terms[i], th.accent, 4);
    if (mode !== 'terms') for (let i = 0; i < N; i++) dot(v, n0 + i, sums[i], th.bad, 4);
    label(v, `N = ${vars.N}, S = ${fmtNum(Number(o.S.toPrecision(6)))}`, 8, 18, th.fg);
  };
  draw();
  return {
    update(next) {
      vars = { ...vars, ...next };
      draw();
    },
    destroy() {
      v.destroy();
    },
  };
}
