// @ts-check
// Многочлены Тейлора: график функции и многочлена степени n (слайдер) в окрестности точки a.
import { createView, drawGrid, plotFn, theme, label, autoRange } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr, math } from '../core/mathx.js';
import { makeFn, sliderSpec } from './kit.js';

export const meta = {
  name: 'taylor',
  params: {
    f: ['E', null, 'функция от x'],
    a: ['E', 0, 'точка разложения'],
    n: ['range', [0, 10, 1], 'степень: [min, max, начало]'],
    x: ['range', [-4, 4], 'окно по x'],
    show: ['str[]', null, 'rem — график остатка'],
  },
  out: ['n', 'a', 'err'],
};

/** Коэффициенты Тейлора c_k = f^(k)(a)/k! для k = 0…N. */
export function coeffs(src, a, N, scope = {}) {
  const out = [];
  let expr = String(src).replace(/\bln\(/g, 'log(');
  let fact = 1;
  for (let k = 0; k <= N; k++) {
    if (k > 0) {
      expr = math.derivative(expr, 'x').toString();
      fact *= k;
    }
    let val = NaN;
    try {
      val = evalExpr(expr, { ...scope, x: a });
    } catch {
      /* вне области */
    }
    out.push(val / fact);
  }
  return out;
}

const spec = (params) => {
  const [min, max, start = min] = params.n ?? [0, 10, 1];
  return sliderSpec('n', [min, max, start, 1]);
};

export function controls(params) {
  return [spec(params)];
}

export function initial(params) {
  return { n: spec(params).start };
}

const poly = (c, a, n) => (x) => {
  let s = 0;
  for (let k = 0; k <= n; k++) s += c[k] * (x - a) ** k;
  return s;
};

export function compute(params, scope, vars) {
  const a = Number(evalExpr(String(params.a ?? 0), scope));
  const n = Math.round(vars.n);
  const c = coeffs(params.f, a, n, scope);
  const f = makeFn(params.f, scope);
  const P = poly(c, a, n);
  const [lo, hi] = params.x ?? [-4, 4];
  let err = 0;
  for (let i = 0; i <= 200; i++) {
    const x = lo + ((hi - lo) * i) / 200;
    const d = Math.abs(f(x) - P(x));
    if (Number.isFinite(d)) err = Math.max(err, d);
  }
  return { n, a, err: Number(err.toFixed(6)) };
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const xr = (params.x ?? [-4, 4]).slice();
  const f = makeFn(params.f, scope);
  const a = Number(evalExpr(String(params.a ?? 0), scope));
  const [, nmax] = params.n ?? [0, 10, 1];
  const all = coeffs(params.f, a, nmax, scope);
  const yr = autoRange(f, xr[0], xr[1]).slice();
  const v = createView(el, { xr, yr, onResize: () => draw() });
  let vars = initial(params);
  const draw = () => {
    drawGrid(v, th);
    const n = Math.round(vars.n);
    plotFn(v, f, th.accent, 3);
    plotFn(v, poly(all, a, n), th.bad, 2.5);
    if ((params.show ?? []).includes('rem')) plotFn(v, (x) => f(x) - poly(all, a, n)(x), th.ok, 1.5);
    const o = compute(params, scope, vars);
    label(v, `n = ${n}, макс. ошибка ${fmtNum(Number(o.err.toPrecision(3)))}`, 8, 18, th.fg);
    v.ctx.fillStyle = th.fg;
    v.ctx.beginPath();
    v.ctx.arc(v.X(a), v.Y(f(a)), 4, 0, Math.PI * 2);
    v.ctx.fill();
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
