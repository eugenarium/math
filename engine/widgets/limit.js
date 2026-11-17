// @ts-check
// Предел: «ε–N» для последовательности и «ε–δ» для функции. Ученик задаёт ε и подбирает N или δ.
import { createView, drawGrid, plotFn, theme, label, dot } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr } from '../core/mathx.js';
import { makeFn, sliderSpec } from './kit.js';

export const meta = {
  name: 'limit',
  params: {
    mode: ['enum', 'seq', 'seq — ε–N для последовательности; ed — ε–δ для функции'],
    an: ['E', null, 'seq: член последовательности, переменная n'],
    f: ['E', null, 'ed: функция от x'],
    a: ['E', 0, 'ed: точка'],
    L: ['E', null, 'предел'],
    x: ['range', null, 'окно по x (ed) или номеров (seq)'],
    y: ['range', null, 'окно по y'],
    sl: ['sliders', null, 'слайдеры; по умолчанию eps и N (seq) или eps и delta (ed)'],
  },
  out: ['eps', 'delta', 'N', 'ok'],
};

const isSeq = (p) => (p.mode ?? 'seq') === 'seq';

export function controls(params) {
  if (params.sl) return Object.entries(params.sl).map(([n, a]) => sliderSpec(n, a));
  return isSeq(params) ? [sliderSpec('eps', [0.05, 1, 0.5, 0.01]), sliderSpec('N', [1, 40, 1, 1])] : [sliderSpec('eps', [0.05, 1, 0.5, 0.01]), sliderSpec('delta', [0.02, 1.5, 0.5, 0.01])];
}

export function initial(params) {
  return Object.fromEntries(controls(params).map((c) => [c.name, c.start]));
}

/** Все члены с номерами n > N лежат в полосе |a_n − L| < ε (проверка до 400 номеров). */
export function seqOk(an, L, eps, N, scope = {}) {
  for (let n = Math.floor(N) + 1; n <= 400; n++) {
    const y = Number(evalExpr(an, { ...scope, n }));
    if (!(Math.abs(y - L) < eps)) return false;
  }
  return true;
}

/** Все x с 0 < |x − a| < δ дают |f(x) − L| < ε (проверка по сетке). */
export function edOk(f, a, L, eps, delta) {
  for (let i = 1; i < 200; i++) {
    const d = (delta * i) / 200;
    for (const x of [a - d, a + d]) {
      const y = f(x);
      if (Number.isFinite(y) && !(Math.abs(y - L) < eps)) return false;
    }
  }
  return true;
}

export function compute(params, scope, vars) {
  const L = Number(evalExpr(String(params.L), scope));
  if (isSeq(params)) {
    const ok = seqOk(params.an, L, vars.eps, vars.N, scope) ? 1 : 0;
    return { eps: vars.eps, N: vars.N, delta: 0, ok };
  }
  const a = Number(evalExpr(String(params.a ?? 0), scope));
  const f = makeFn(params.f, scope);
  return { eps: vars.eps, delta: vars.delta, N: 0, ok: edOk(f, a, L, vars.eps, vars.delta) ? 1 : 0 };
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const seq = isSeq(params);
  const L = Number(evalExpr(String(params.L), scope));
  const a = seq ? 0 : Number(evalExpr(String(params.a ?? 0), scope));
  const xr = (params.x ?? (seq ? [0, 40] : [a - 2, a + 2])).slice();
  const f = seq ? null : makeFn(params.f, scope);
  const an = (n) => Number(evalExpr(params.an, { ...scope, n }));
  let yr;
  if (params.y) yr = params.y.slice();
  else if (seq) {
    const ys = Array.from({ length: 40 }, (_, i) => an(i + 1));
    yr = [Math.min(L, ...ys) - 0.5, Math.max(L, ...ys) + 0.5];
  } else yr = [L - 2, L + 2];
  const v = createView(el, { xr, yr, onResize: () => draw() });
  let vars = initial(params);
  const draw = () => {
    drawGrid(v, th);
    const { ctx: c } = v;
    const o = compute(params, scope, vars);
    const col = o.ok ? th.ok : th.bad;
    // полоса L ± ε
    c.fillStyle = col + '33';
    c.fillRect(0, v.Y(L + vars.eps), v.w, v.Y(L - vars.eps) - v.Y(L + vars.eps));
    c.strokeStyle = col;
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    for (const y of [L - vars.eps, L + vars.eps]) {
      c.beginPath();
      c.moveTo(0, v.Y(y));
      c.lineTo(v.w, v.Y(y));
      c.stroke();
    }
    c.setLineDash([]);
    if (seq) {
      for (let n = 1; n <= xr[1]; n++) dot(v, n, an(n), n > vars.N ? col : th.muted, 4);
      c.strokeStyle = th.fg;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(v.X(vars.N + 0.5), 0);
      c.lineTo(v.X(vars.N + 0.5), v.h);
      c.stroke();
      label(v, `N = ${vars.N}`, v.X(vars.N + 0.5) + 6, 16, th.fg);
    } else {
      c.fillStyle = col + '22';
      c.fillRect(v.X(a - vars.delta), 0, v.X(a + vars.delta) - v.X(a - vars.delta), v.h);
      plotFn(v, f, th.accent, 3);
      dot(v, a, L, th.fg, 4);
      label(v, `δ = ${fmtNum(Number(vars.delta.toFixed(2)))}`, v.X(a) + 6, 16, th.fg);
    }
    label(v, `ε = ${fmtNum(Number(vars.eps.toFixed(2)))}: ${o.ok ? 'условие выполнено' : 'есть точки вне полосы'}`, 8, v.h - 8, col);
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
