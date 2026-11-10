// @ts-check
// Графики y = f(x) со слайдерами, касательной, секущей, площадью, точками и перетаскиваемой точкой.
import { createView, theme, drawGrid, plotFn, plotLine, dot, label, autoRange, ASPECT } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalParam, makeFn, sliderSpec, scopeVars } from './kit.js';

export const meta = {
  name: 'fplot',
  params: {
    f: ['E|E[]', null, 'кривые, переменная x'],
    x: ['range', [-5, 5], 'окно по x'],
    y: ['range', null, 'окно по y; по умолчанию по первой кривой'],
    sl: ['sliders', null, 'слайдеры {имя: [min, max, начало, шаг]}'],
    tan: ['E', null, 'касательная к первой кривой в точке x0'],
    sec: ['E[]', null, 'секущая через x0 и x0+h'],
    area: ['E[]', null, 'площадь под первой кривой на [a, b]'],
    pts: ['E[][]', null, 'отмеченные точки'],
    drag: ['obj', null, '{P: [x0]} точка на первой кривой; {P: [x0, y0]} свободная точка'],
  },
  out: ['P.x', 'P.y'],
};

const asList = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const CURVE_COLORS = ['accent', 'bad', 'ok', 'muted'];

const dragName = (params) => (params.drag ? Object.keys(params.drag)[0] : null);

export function controls(params) {
  return Object.entries(params.sl ?? {}).map(([name, a]) => sliderSpec(name, a));
}

export function initial(params, scope = {}) {
  const vars = {};
  for (const c of controls(params)) vars[c.name] = c.start;
  const name = dragName(params);
  if (name) {
    const spec = params.drag[name];
    const x0 = evalParam(spec[0], { ...scope, ...vars });
    vars[`${name}.x`] = x0;
    vars[`${name}.y`] = spec.length > 1 ? evalParam(spec[1], { ...scope, ...vars }) : makeFn(asList(params.f)[0], { ...scope, ...vars })(x0);
  }
  return vars;
}

export function compute(_params, _scope, vars) {
  return { ...vars };
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const fs = asList(params.f);
  const name = dragName(params);
  const free = name && params.drag[name].length > 1;
  let vars = initial(params, scope);
  const sc = () => ({ ...scope, ...scopeVars(vars) });
  const xr = (params.x ?? [-5, 5]).slice();
  const pts0 = asList(params.pts).map((p) => evalParam(p, sc()));
  const yr = (params.y ?? autoRange(makeFn(fs[0], sc()), xr[0], xr[1], pts0.map((p) => p[1]))).slice();
  let v;

  const draw = () => {
    const S = sc();
    drawGrid(v, th);
    const curves = fs.map((src) => makeFn(src, S));
    const f0 = curves[0];

    if (params.area) {
      const [a, b] = evalParam(params.area, S);
      const { ctx: c2 } = v;
      c2.fillStyle = th.accent + '40';
      c2.beginPath();
      c2.moveTo(v.X(a), v.Y(0));
      for (let i = 0; i <= 120; i++) {
        const x = a + ((b - a) * i) / 120;
        c2.lineTo(v.X(x), v.Y(Number.isFinite(f0(x)) ? f0(x) : 0));
      }
      c2.lineTo(v.X(b), v.Y(0));
      c2.closePath();
      c2.fill();
      let s = f0(a) + f0(b);
      for (let i = 1; i < 400; i++) s += f0(a + ((b - a) * i) / 400) * (i % 2 ? 4 : 2);
      label(v, `∫ = ${fmtNum(Number(((s * (b - a)) / 1200).toPrecision(5)))}`, 10, 18, th.fg);
    }

    curves.forEach((f, i) => plotFn(v, f, th[CURVE_COLORS[i % 4]], i === 0 ? 2.8 : 2.2));

    if (params.tan !== undefined) {
      const x0 = evalParam(params.tan, S);
      const h = 1e-6 * Math.max(1, Math.abs(x0));
      const m = (f0(x0 + h) - f0(x0 - h)) / (2 * h);
      if (Number.isFinite(m)) {
        plotLine(v, x0, f0(x0), m, th.bad, 2);
        dot(v, x0, f0(x0), th.bad);
        label(v, `наклон ${fmtNum(Number(m.toPrecision(4)))}`, 10, 18, th.fg);
      }
    }
    if (params.sec) {
      const [x0, h] = evalParam(params.sec, S);
      const m = (f0(x0 + h) - f0(x0)) / h;
      if (Number.isFinite(m)) {
        plotLine(v, x0, f0(x0), m, th.bad, 2, [6, 4]);
        dot(v, x0, f0(x0), th.bad);
        dot(v, x0 + h, f0(x0 + h), th.bad);
        label(v, `наклон ${fmtNum(Number(m.toPrecision(4)))}`, 10, 18, th.fg);
      }
    }
    for (const p of asList(params.pts).map((p) => evalParam(p, S))) dot(v, p[0], p[1], th.fg, 4);
    if (name) dot(v, vars[`${name}.x`], vars[`${name}.y`], th.ok, 8);
  };

  v = createView(el, { xr, yr, aspect: ASPECT[params.h] ?? ASPECT.m, onResize: draw });

  if (name) {
    v.canvas.style.touchAction = 'none';
    let dragging = false;
    const move = (e) => {
      const [px, py] = v.pos(e);
      const x = Math.min(xr[1], Math.max(xr[0], v.ix(px)));
      const y = free ? v.iy(py) : makeFn(fs[0], sc())(x);
      if (!Number.isFinite(y)) return;
      vars = { ...vars, [`${name}.x`]: x, [`${name}.y`]: y };
      draw();
      ctx.onChange?.({ [`${name}.x`]: x, [`${name}.y`]: y });
    };
    v.canvas.addEventListener('pointerdown', (e) => {
      const [px, py] = v.pos(e);
      if (Math.hypot(px - v.X(vars[`${name}.x`]), py - v.Y(vars[`${name}.y`])) > 36) return;
      dragging = true;
      v.canvas.setPointerCapture(e.pointerId);
    });
    v.canvas.addEventListener('pointermove', (e) => dragging && move(e));
    v.canvas.addEventListener('pointerup', () => (dragging = false));
    v.canvas.addEventListener('pointercancel', () => (dragging = false));
  }

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
