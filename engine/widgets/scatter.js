// @ts-check
// Диаграмма рассеяния: облако точек, регрессионная прямая, корреляция, подбор прямой слайдерами.
import { createView, drawGrid, theme, plotLine, dot, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'scatter',
  params: {
    gen: ['obj', null, 'облако {n, r, seed}: n точек с корреляцией r'],
    pts: ['E[][]', null, 'точки [[x, y], …]'],
    fit: ['enum', null, 'line — показать МНК-прямую; hand — ученик подбирает прямую слайдерами k и b'],
    show: ['str[]', null, 'r, r2, sse, mean, resid'],
    vals: ['E[]', null, 'одномерные данные для one: hist'],
    one: ['enum', null, 'hist — гистограмма значений vals с средним и медианой'],
    x: ['range', null, 'окно по x'],
    y: ['range', null, 'окно по y'],
  },
  out: ['r', 'k', 'b', 'sse', 'mean', 'med', 'ky', 'by'],
};

/** Генератор псевдослучайных чисел mulberry32. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

export function points(params) {
  if (params.vals) return params.vals.map((x) => [Number(x), 0]);
  if (params.pts) return params.pts.map((p) => [Number(p[0]), Number(p[1])]);
  const g = params.gen ?? { n: 30, r: 0.7, seed: 1 };
  const r = rng(g.seed ?? 1);
  const n = g.n ?? 30;
  const rho = g.r ?? 0.7;
  return Array.from({ length: n }, () => {
    const z1 = gauss(r);
    const z2 = gauss(r);
    return [Number((5 + 2 * z1).toFixed(2)), Number((5 + 2 * (rho * z1 + Math.sqrt(1 - rho * rho) * z2)).toFixed(2))];
  });
}

export function stats(pts) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  const k = sxy / sxx;
  const sorted = pts.map((p) => p[0]).sort((a, b) => a - b);
  const med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return { n, mx, my, k, b: my - k * mx, r: sxy / Math.sqrt(sxx * syy), med };
}

export function controls(params) {
  if (params.fit !== 'hand') return [];
  return [sliderSpec('k', [-3, 3, 0, 0.1]), sliderSpec('b', [-5, 10, 0, 0.5])];
}

export function initial(params) {
  return params.fit === 'hand' ? { k: 0, b: 0 } : {};
}

export function compute(params, scope, vars) {
  const pts = points(params);
  const s = stats(pts);
  const k = vars.k ?? s.k;
  const b = vars.b ?? s.b;
  const sse = pts.reduce((a, [x, y]) => a + (y - (b + k * x)) ** 2, 0);
  const r6 = (x) => Number(x.toFixed(6));
  return { r: r6(s.r), k: r6(k), b: r6(b), sse: r6(sse), mean: r6(s.mx), med: r6(s.med), ky: r6(s.k), by: r6(s.b) };
}

function mountHist(el, params, th) {
  const vals = points(params).map((p) => p[0]);
  const n = vals.length;
  const lo = Math.floor(Math.min(...vals)) - 1;
  const hi = Math.ceil(Math.max(...vals)) + 1;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sorted = [...vals].sort((a, b) => a - b);
  const med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const v = createView(el, { xr: [lo, hi], yr: [0, 1], aspect: 0.6, onResize: () => draw() });
  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    const bins = Math.max(4, Math.min(12, hi - lo));
    const counts = new Array(bins).fill(0);
    for (const x of vals) counts[Math.min(bins - 1, Math.floor(((x - lo) / (hi - lo)) * bins))]++;
    const mx = Math.max(...counts);
    const bottom = h - 24;
    c.fillStyle = th.accent + 'aa';
    counts.forEach((cn, k) => c.fillRect((k / bins) * w + 1, bottom - (cn / mx) * (bottom - 40), w / bins - 2, (cn / mx) * (bottom - 40)));
    c.strokeStyle = th.fg;
    c.beginPath();
    c.moveTo(0, bottom);
    c.lineTo(w, bottom);
    c.stroke();
    for (const [x, col, name] of [[mean, th.bad, 'среднее'], [med, th.ok, 'медиана']]) {
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(v.X(x), 30);
      c.lineTo(v.X(x), bottom);
      c.stroke();
      void name;
    }
    c.fillStyle = th.fg;
    c.font = '12px system-ui, sans-serif';
    c.textAlign = 'center';
    for (let t = Math.ceil(lo); t <= hi; t += Math.max(1, Math.round((hi - lo) / 6))) c.fillText(fmtNum(t), v.X(t), h - 8);
    label(v, `среднее ${fmtNum(Number(mean.toFixed(2)))} (красная), медиана ${fmtNum(med)} (зелёная)`, 8, 18, th.fg);
  };
  draw();
  return { update: draw, destroy: () => v.destroy() };
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  if (params.one === 'hist') return mountHist(el, params, th);
  const pts = points(params);
  const s = stats(pts);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = (a, b) => [Math.floor(Math.min(...a) - 1), Math.ceil(Math.max(...b) + 1)];
  const xr = (params.x ?? pad(xs, xs)).slice();
  const yr = (params.y ?? pad(ys, ys)).slice();
  const show = new Set(params.show ?? []);
  let vars = initial(params);
  const v = createView(el, { xr, yr, aspect: 0.8, onResize: () => draw() });
  const draw = () => {
    drawGrid(v, th);
    const o = compute(params, {}, vars);
    if (show.has('mean')) {
      plotLine(v, s.mx, s.my, 0, th.muted, 1, [4, 4]);
      v.ctx.setLineDash([4, 4]);
      v.ctx.strokeStyle = th.muted;
      v.ctx.beginPath();
      v.ctx.moveTo(v.X(s.mx), v.Y(yr[0]));
      v.ctx.lineTo(v.X(s.mx), v.Y(yr[1]));
      v.ctx.stroke();
      v.ctx.setLineDash([]);
    }
    const line = params.fit === 'hand' ? { k: o.k, b: o.b } : params.fit === 'line' ? { k: s.k, b: s.b } : null;
    if (line && show.has('resid')) {
      v.ctx.strokeStyle = th.bad + '99';
      v.ctx.lineWidth = 1.5;
      for (const [x, y] of pts) {
        v.ctx.beginPath();
        v.ctx.moveTo(v.X(x), v.Y(y));
        v.ctx.lineTo(v.X(x), v.Y(line.b + line.k * x));
        v.ctx.stroke();
      }
    }
    if (line) plotLine(v, 0, line.b, line.k, th.accent, 3);
    for (const [x, y] of pts) dot(v, x, y, th.fg, 4);
    const info = [];
    if (show.has('r')) info.push(`r = ${fmtNum(Number(o.r.toFixed(3)))}`);
    if (show.has('r2')) info.push(`R² = ${fmtNum(Number((o.r * o.r).toFixed(3)))}`);
    if (show.has('sse') || params.fit === 'hand') info.push(`SSE = ${fmtNum(Number(o.sse.toFixed(2)))}`);
    if (line) info.push(`y = ${fmtNum(Number(line.b.toFixed(2)))} ${line.k < 0 ? '−' : '+'} ${fmtNum(Math.abs(Number(line.k.toFixed(2))))}x`);
    info.forEach((t, i) => label(v, t, 8, 18 + 20 * i, th.fg));
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
