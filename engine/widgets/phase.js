// @ts-check
// Фазовый портрет линейной системы x' = Ax: траектории по касанию, тип особой точки по следу и определителю.
import { createView, drawGrid, theme, label, dot } from '../core/plot.js';
import { evalExpr } from '../core/mathx.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'phase',
  params: {
    A: ['E[][]', [[0, 1], [-1, 0]], 'матрица 2×2, элементы — выражения'],
    sl: ['sliders', null, 'слайдеры параметров матрицы, например {a: [-2, 2, 0.5, 0.1]}'],
    win: ['range', [-4, 4], 'окно по обеим осям'],
  },
  out: ['tr', 'det', 'type'],
};

export function controls(params) {
  return Object.entries(params.sl ?? {}).map(([n, a]) => sliderSpec(n, a));
}
export function initial(params) {
  return Object.fromEntries(controls(params).map((c) => [c.name, c.start]));
}

const matrix = (params, scope, vars) => (params.A ?? [[0, 1], [-1, 0]]).map((r) => r.map((e) => Number(evalExpr(String(e), { ...scope, ...vars }))));

/** Тип особой точки: 1 — узел, 2 — седло, 3 — фокус, 4 — центр, 0 — вырожденный случай. */
export function classify(A) {
  const tr = A[0][0] + A[1][1];
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (Math.abs(det) < 1e-9) return { tr, det, type: 0 };
  if (det < 0) return { tr, det, type: 2 };
  const D = tr * tr - 4 * det;
  if (D >= 0) return { tr, det, type: 1 };
  return { tr, det, type: Math.abs(tr) < 1e-9 ? 4 : 3 };
}

export function compute(params, scope, vars) {
  const r = classify(matrix(params, scope, vars));
  return { tr: Number(r.tr.toFixed(6)), det: Number(r.det.toFixed(6)), type: r.type };
}

const NAMES = ['вырожденный', 'узел', 'седло', 'фокус', 'центр'];

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const [lo, hi] = params.win ?? [-4, 4];
  let vars = initial(params);
  const starts = [[2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [0, 3], [-3, 0], [0, -3]];
  const v = createView(el, { xr: [lo, hi], yr: [lo, hi], aspect: 1, onResize: () => draw() });
  const traj = (A, x0, y0, sign = 1) => {
    const pts = [[x0, y0]];
    let x = x0, y = y0;
    const h = 0.02 * sign;
    for (let i = 0; i < 400; i++) {
      const f = (X, Y) => [A[0][0] * X + A[0][1] * Y, A[1][0] * X + A[1][1] * Y];
      const k1 = f(x, y);
      const k2 = f(x + (h * k1[0]) / 2, y + (h * k1[1]) / 2);
      const k3 = f(x + (h * k2[0]) / 2, y + (h * k2[1]) / 2);
      const k4 = f(x + h * k3[0], y + h * k3[1]);
      x += (h * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])) / 6;
      y += (h * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])) / 6;
      if (Math.abs(x) > 3 * hi || Math.abs(y) > 3 * hi) break;
      pts.push([x, y]);
    }
    return pts;
  };
  const extra = [];
  const draw = () => {
    drawGrid(v, th);
    const A = matrix(params, scope, vars);
    const { ctx: c } = v;
    c.lineWidth = 2;
    for (const [x0, y0] of [...starts, ...extra]) {
      for (const sign of [1, -1]) {
        c.strokeStyle = sign > 0 ? th.accent : th.muted;
        c.beginPath();
        traj(A, x0, y0, sign).forEach(([x, y], i) => (i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y))));
        c.stroke();
      }
    }
    dot(v, 0, 0, th.fg, 5);
    const r = classify(A);
    label(v, `след ${Number(r.tr.toFixed(2))}, определитель ${Number(r.det.toFixed(2))}: ${NAMES[r.type]}`, 8, 18, th.fg);
  };
  v.canvas.addEventListener('pointerdown', (e) => {
    const [px, py] = v.pos(e);
    extra.push([v.ix(px), v.iy(py)]);
    if (extra.length > 6) extra.shift();
    draw();
  });
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
