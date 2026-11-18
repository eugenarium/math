// @ts-check
// Поле направлений y' = F(x, y) и численные решения: точное, Эйлера, Рунге–Кутты 4-го порядка с шагом-слайдером.
import { createView, drawGrid, theme, label, dot } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr } from '../core/mathx.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'slope',
  params: {
    F: ['E', null, 'правая часть y′ = F(x, y)'],
    x: ['range', [-3, 3], 'окно по x'],
    y: ['range', [-3, 3], 'окно по y'],
    ic: ['E[][]', [[0, 1]], 'начальные условия [[x0, y0]]'],
    m: ['str|str[]', 'rk4', 'exact | euler | rk4'],
    hs: ['range', [0.05, 1, 0.5], 'шаг: [min, max, начало]'],
    sol: ['E', null, 'точное решение y(x), если известно'],
  },
  out: ['hs', 'err', 'x0', 'y0'],
};

const hspec = (p) => {
  const [mn, mx, st = mn] = p.hs ?? [0.05, 1, 0.5];
  return sliderSpec('hs', [mn, mx, st, 0.05]);
};
export function controls(params) {
  return [hspec(params)];
}
export function initial(params) {
  const [x0, y0] = (params.ic ?? [[0, 1]])[0];
  return { hs: hspec(params).start, x0, y0 };
}

const F = (src, scope) => (x, y) => Number(evalExpr(src, { ...scope, x, y }));

/** Метод Эйлера или РК4 от (x0, y0) до xEnd с шагом h; возвращает ломаную. */
export function integrate(f, x0, y0, xEnd, h, method) {
  const pts = [[x0, y0]];
  const n = Math.max(1, Math.round(Math.abs(xEnd - x0) / h));
  const step = (xEnd - x0) / n;
  let x = x0, y = y0;
  for (let i = 0; i < n; i++) {
    if (method === 'euler') y += step * f(x, y);
    else {
      const k1 = f(x, y);
      const k2 = f(x + step / 2, y + (step * k1) / 2);
      const k3 = f(x + step / 2, y + (step * k2) / 2);
      const k4 = f(x + step, y + step * k3);
      y += (step * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
    }
    x += step;
    pts.push([x, y]);
  }
  return pts;
}

export function compute(params, scope, vars) {
  const f = F(params.F, scope);
  const methods = Array.isArray(params.m) ? params.m : [params.m ?? 'rk4'];
  const xEnd = (params.x ?? [-3, 3])[1];
  let err = 0;
  if (params.sol) {
    const m = methods.find((q) => q !== 'exact') ?? 'rk4';
    const pts = integrate(f, vars.x0, vars.y0, xEnd, vars.hs, m);
    const [xl, yl] = pts[pts.length - 1];
    err = Math.abs(yl - Number(evalExpr(params.sol, { ...scope, x: xl })));
  }
  return { hs: vars.hs, err: Number(err.toFixed(6)), x0: vars.x0, y0: vars.y0 };
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const xr = (params.x ?? [-3, 3]).slice();
  const yr = (params.y ?? [-3, 3]).slice();
  const f = F(params.F, scope);
  const methods = Array.isArray(params.m) ? params.m : [params.m ?? 'rk4'];
  let vars = initial(params);
  const v = createView(el, { xr, yr, aspect: 0.8, onResize: () => draw() });
  const draw = () => {
    drawGrid(v, th);
    const { ctx: c } = v;
    c.strokeStyle = th.line;
    c.lineWidth = 1.5;
    for (let i = 0; i <= 14; i++)
      for (let j = 0; j <= 11; j++) {
        const x = xr[0] + ((xr[1] - xr[0]) * i) / 14;
        const y = yr[0] + ((yr[1] - yr[0]) * j) / 11;
        const s = f(x, y);
        if (!Number.isFinite(s)) continue;
        const ang = Math.atan(s * ((yr[1] - yr[0]) / (xr[1] - xr[0])) * (v.w / v.h));
        const L = 11;
        c.beginPath();
        c.moveTo(v.X(x) - L * Math.cos(ang), v.Y(y) + L * Math.sin(ang));
        c.lineTo(v.X(x) + L * Math.cos(ang), v.Y(y) - L * Math.sin(ang));
        c.stroke();
      }
    const colors = { exact: th.ok, euler: th.bad, rk4: th.accent };
    for (const m of methods) {
      c.strokeStyle = colors[m] ?? th.accent;
      c.lineWidth = 3;
      c.beginPath();
      if (m === 'exact' && params.sol) {
        for (let i = 0; i <= 200; i++) {
          const x = xr[0] + ((xr[1] - xr[0]) * i) / 200;
          const y = Number(evalExpr(params.sol, { ...scope, x }));
          i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y));
        }
      } else {
        const pts = integrate(f, vars.x0, vars.y0, xr[1], vars.hs, m === 'euler' ? 'euler' : 'rk4');
        pts.forEach(([x, y], i) => (i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y))));
      }
      c.stroke();
    }
    dot(v, vars.x0, vars.y0, th.fg, 5);
    const o = compute(params, scope, vars);
    label(v, `шаг ${fmtNum(Number(vars.hs.toFixed(2)))}${params.sol ? `, ошибка в конце ${fmtNum(Number(o.err.toPrecision(3)))}` : ''}`, 8, 18, th.fg);
  };
  v.canvas.addEventListener('pointerdown', (e) => {
    const [px, py] = v.pos(e);
    vars = { ...vars, x0: Number(v.ix(px).toFixed(2)), y0: Number(v.iy(py).toFixed(2)) };
    draw();
    ctx.onChange?.({ x0: vars.x0, y0: vars.y0 });
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
