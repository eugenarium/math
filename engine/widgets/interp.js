// @ts-check
// Интерполяция и аппроксимация: многочлен Лагранжа или МНК-многочлен по узлам, равномерным или чебышёвским.
import { createView, drawGrid, theme, label, dot, plotFn } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { makeFn, sliderSpec } from './kit.js';

export const meta = {
  name: 'interp',
  params: {
    f: ['E', null, 'функция-эталон'],
    nodes: ['range', [2, 14, 5], 'число узлов: [min, max, начало]'],
    kind: ['enum', 'equi', 'equi — равномерные узлы; cheb — чебышёвские'],
    m: ['str', 'lagrange', 'lagrange | ls:K — МНК-многочлен степени K'],
    x: ['range', [-1, 1], 'отрезок'],
  },
  out: ['nodes', 'maxerr', 'deg'],
};

export function controls(params) {
  const [mn, mx, st = mn] = params.nodes ?? [2, 14, 5];
  return [sliderSpec('nodes', [mn, mx, st, 1])];
}
export function initial(params) {
  return { nodes: controls(params)[0].start };
}

export function nodePoints(kind, n, [a, b]) {
  return Array.from({ length: n }, (_, i) => (kind === 'cheb' ? (a + b) / 2 + ((b - a) / 2) * Math.cos(((2 * i + 1) * Math.PI) / (2 * n)) : a + ((b - a) * i) / (n - 1)));
}

/** Многочлен Лагранжа по узлам (xs, ys). */
export function lagrange(xs, ys) {
  return (x) => {
    let s = 0;
    for (let i = 0; i < xs.length; i++) {
      let t = ys[i];
      for (let j = 0; j < xs.length; j++) if (j !== i) t *= (x - xs[j]) / (xs[i] - xs[j]);
      s += t;
    }
    return s;
  };
}

/** МНК-многочлен степени deg: решение нормальных уравнений методом Гаусса. */
export function lsq(xs, ys, deg) {
  const n = deg + 1;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => xs.reduce((s, x) => s + x ** (i + j), 0)));
  const b = Array.from({ length: n }, (_, i) => xs.reduce((s, x, k) => s + ys[k] * x ** i, 0));
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const k = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= k * A[i][c];
      b[r] -= k * b[i];
    }
  }
  const co = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * co[j];
    co[i] = s / A[i][i];
  }
  return (x) => co.reduce((s, c, i) => s + c * x ** i, 0);
}

const build = (params, scope, n) => {
  const f = makeFn(params.f, scope);
  const xs = nodePoints(params.kind ?? 'equi', n, params.x ?? [-1, 1]);
  const ys = xs.map(f);
  const m = params.m ?? 'lagrange';
  const deg = m.startsWith('ls:') ? Number(m.slice(3)) : n - 1;
  const P = m.startsWith('ls:') ? lsq(xs, ys, deg) : lagrange(xs, ys);
  return { f, xs, ys, P, deg };
};

export function compute(params, scope, vars) {
  const n = Math.round(vars.nodes);
  const { f, P, deg } = build(params, scope, n);
  const [a, b] = params.x ?? [-1, 1];
  let me = 0;
  for (let i = 0; i <= 400; i++) {
    const x = a + ((b - a) * i) / 400;
    me = Math.max(me, Math.abs(f(x) - P(x)));
  }
  return { nodes: n, maxerr: Number(me.toFixed(6)), deg };
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const xr = (params.x ?? [-1, 1]).slice();
  const f = makeFn(params.f, scope);
  const ys0 = Array.from({ length: 100 }, (_, i) => f(xr[0] + ((xr[1] - xr[0]) * i) / 99));
  const yr = [Math.min(...ys0) - 0.5, Math.max(...ys0) + 0.5];
  const v = createView(el, { xr, yr, onResize: () => draw() });
  let vars = initial(params);
  const draw = () => {
    drawGrid(v, th);
    const n = Math.round(vars.nodes);
    const { xs, ys, P } = build(params, scope, n);
    plotFn(v, f, th.accent, 3);
    plotFn(v, (x) => {
      const y = P(x);
      return Math.abs(y) > 20 ? NaN : y;
    }, th.bad, 2.5);
    xs.forEach((x, i) => dot(v, x, ys[i], th.fg, 4));
    const o = compute(params, scope, vars);
    label(v, `узлов ${n}, степень ${o.deg}, макс. ошибка ${fmtNum(Number(o.maxerr.toPrecision(3)))}`, 8, 18, th.fg);
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
