// @ts-check
// Итерационные методы решения уравнений: бисекция, Ньютон, секущие, простая итерация. Ошибка по шагам.
import { createView, drawGrid, theme, label, dot, plotFn } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr, math } from '../core/mathx.js';
import { makeFn, sliderSpec } from './kit.js';

export const meta = {
  name: 'iter',
  params: {
    m: ['enum', 'newton', 'bisect | newton | secant | fixed'],
    f: ['E', null, 'функция f(x); для fixed — g в x = g(x)'],
    x0: ['E', 1, 'начальное приближение'],
    x1: ['E', 2, 'второе приближение (secant)'],
    ab: ['E[]', [0, 2], 'отрезок для bisect'],
    n: ['range', [0, 12, 3], 'число шагов: [min, max, начало]'],
    x: ['range', [-1, 3], 'окно по x'],
  },
  out: ['n', 'x', 'err'],
};

export function controls(params) {
  const [mn, mx, st = mn] = params.n ?? [0, 12, 3];
  return [sliderSpec('n', [mn, mx, st, 1])];
}
export function initial(params) {
  return { n: controls(params)[0].start };
}

/** Последовательность приближений метода (n шагов). */
export function sequence(params, scope, n) {
  const f = makeFn(params.f, scope);
  const m = params.m ?? 'newton';
  const d = (x) => (f(x + 1e-6) - f(x - 1e-6)) / 2e-6;
  const seq = [];
  if (m === 'bisect') {
    let [a, b] = (params.ab ?? [0, 2]).map((e) => Number(evalExpr(String(e), scope)));
    seq.push((a + b) / 2);
    for (let i = 0; i < n; i++) {
      const c = (a + b) / 2;
      if (f(a) * f(c) <= 0) b = c;
      else a = c;
      seq.push((a + b) / 2);
    }
    return seq;
  }
  let x = Number(evalExpr(String(params.x0 ?? 1), scope));
  seq.push(x);
  if (m === 'secant') {
    let xp = x;
    x = Number(evalExpr(String(params.x1 ?? 2), scope));
    seq.push(x);
    for (let i = 1; i < n; i++) {
      const den = f(x) - f(xp);
      const nx = den === 0 ? x : x - (f(x) * (x - xp)) / den;
      xp = x;
      x = nx;
      seq.push(x);
    }
    return seq.slice(0, n + 1);
  }
  for (let i = 0; i < n; i++) {
    x = m === 'fixed' ? f(x) : x - f(x) / d(x);
    seq.push(x);
  }
  return seq;
}

/** Предел последовательности: много шагов того же метода. */
export function limitOf(params, scope) {
  const s = sequence(params, scope, 80);
  return s[s.length - 1];
}

export function compute(params, scope, vars) {
  const seq = sequence(params, scope, Math.round(vars.n));
  const x = seq[seq.length - 1];
  const root = limitOf(params, scope);
  return { n: vars.n, x: Number(x.toFixed(8)), err: Number(Math.abs(x - root).toExponential(6)) };
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const xr = (params.x ?? [-1, 3]).slice();
  const f = makeFn(params.f, scope);
  const fixed = params.m === 'fixed';
  const ys = Array.from({ length: 100 }, (_, i) => f(xr[0] + ((xr[1] - xr[0]) * i) / 99)).filter((y) => Number.isFinite(y) && Math.abs(y) < 50);
  const yr = fixed ? xr.slice() : [Math.min(...ys, -1), Math.max(...ys, 1)];
  const v = createView(el, { xr, yr, aspect: fixed ? 0.9 : 0.64, onResize: () => draw() });
  let vars = initial(params);
  const draw = () => {
    drawGrid(v, th);
    const { ctx: c } = v;
    plotFn(v, f, th.accent, 3);
    if (fixed) plotFn(v, (x) => x, th.muted, 1.5);
    const n = Math.round(vars.n);
    const seq = sequence(params, scope, n);
    if (fixed) {
      // паутинная диаграмма
      c.strokeStyle = th.bad;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(v.X(seq[0]), v.Y(0));
      for (let i = 0; i < seq.length - 1; i++) {
        c.lineTo(v.X(seq[i]), v.Y(seq[i + 1]));
        c.lineTo(v.X(seq[i + 1]), v.Y(seq[i + 1]));
      }
      c.stroke();
    } else seq.forEach((x, i) => dot(v, x, 0, i === seq.length - 1 ? th.bad : th.muted, i === seq.length - 1 ? 6 : 4));
    const o = compute(params, scope, vars);
    label(v, `шагов ${n}, x = ${fmtNum(Number(o.x.toPrecision(8)))}, ошибка ${o.err.toExponential(1)}`, 8, 18, th.fg);
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
void math;
