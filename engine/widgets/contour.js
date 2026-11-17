// @ts-check
// Двумерное нормальное распределение: эллипсы равной плотности, слайдеры корреляции и разбросов; равномерная область.
import { createView, drawGrid, theme, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'contour',
  params: {
    kind: ['enum', 'normal', 'normal — эллипсы равной плотности; unif — равномерная область'],
    region: ['enum', 'rect', 'unif: rect | tri — прямоугольник 4×5 или треугольник x+y≤4 с подвижной точкой отсечения c'],
    sl: ['sliders', null, 'слайдеры; по умолчанию rho, sx, sy (normal) или c (unif)'],
  },
  out: ['rho', 'sx', 'sy', 'cov', 'P'],
};

export function controls(params) {
  if (params.sl) return Object.entries(params.sl).map(([n, a]) => sliderSpec(n, a));
  if (params.kind === 'unif') return [sliderSpec('c', [0.5, 3.5, 1.5, 0.5])];
  return [sliderSpec('rho', [-0.95, 0.95, 0.5, 0.05]), sliderSpec('sx', [0.5, 2.5, 1, 0.1]), sliderSpec('sy', [0.5, 2.5, 1, 0.1])];
}

export function initial(params) {
  return Object.fromEntries(controls(params).map((c) => [c.name, c.start]));
}

/** Доля площади области x<c: прямоугольник 4×5 — c/4; треугольник x+y≤4 — 1−((4−c)/4)². */
export function probLeft(region, c) {
  return region === 'tri' ? 1 - ((4 - c) / 4) ** 2 : c / 4;
}

export function compute(params, scope, vars) {
  if (params.kind === 'unif') return { rho: 0, sx: 0, sy: 0, cov: 0, P: Number(probLeft(params.region ?? 'rect', vars.c).toFixed(6)) };
  const rho = vars.rho ?? 0, sx = vars.sx ?? 1, sy = vars.sy ?? 1;
  return { rho, sx, sy, cov: Number((rho * sx * sy).toFixed(6)), P: 0 };
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const unif = params.kind === 'unif';
  const v = createView(el, { xr: unif ? [-0.5, 5] : [-4, 4], yr: unif ? [-0.5, 5.5] : [-4, 4], aspect: unif ? 0.9 : 1, onResize: () => draw() });
  let vars = initial(params);
  const draw = () => {
    drawGrid(v, th);
    const { ctx: c } = v;
    if (unif) {
      const tri = params.region === 'tri';
      const poly = tri ? [[0, 0], [4, 0], [0, 4]] : [[0, 0], [4, 0], [4, 5], [0, 5]];
      c.beginPath();
      poly.forEach(([x, y], i) => (i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y))));
      c.closePath();
      c.fillStyle = th.accent + '33';
      c.fill();
      c.strokeStyle = th.accent;
      c.lineWidth = 2.5;
      c.stroke();
      // область x < c
      c.save();
      c.beginPath();
      c.rect(v.X(0), 0, v.X(vars.c) - v.X(0), v.h);
      c.clip();
      c.beginPath();
      poly.forEach(([x, y], i) => (i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y))));
      c.closePath();
      c.fillStyle = th.bad + '66';
      c.fill();
      c.restore();
      c.strokeStyle = th.bad;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(v.X(vars.c), 0);
      c.lineTo(v.X(vars.c), v.h);
      c.stroke();
      const o = compute(params, {}, vars);
      label(v, `X < ${fmtNum(vars.c)}: вероятность ${fmtNum(Number(o.P.toFixed(3)))}`, 8, 18, th.fg);
      return;
    }
    const o = compute(params, {}, vars);
    for (const k of [1, 2]) {
      c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * 2 * Math.PI;
        // точка эллипса k σ: x = sx·k·cos t, y = sy·k·(ρ cos t + √(1−ρ²) sin t)
        const x = o.sx * k * Math.cos(t);
        const y = o.sy * k * (o.rho * Math.cos(t) + Math.sqrt(1 - o.rho * o.rho) * Math.sin(t));
        i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y));
      }
      c.closePath();
      c.strokeStyle = k === 1 ? th.accent : th.muted;
      c.lineWidth = 2.5;
      c.stroke();
    }
    label(v, `ρ = ${fmtNum(Number(o.rho.toFixed(2)))}, σx = ${fmtNum(Number(o.sx.toFixed(1)))}, σy = ${fmtNum(Number(o.sy.toFixed(1)))}, cov = ${fmtNum(Number(o.cov.toFixed(2)))}`, 8, 18, th.fg);
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
