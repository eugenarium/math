// @ts-check
// Проверка гипотез: распределение статистики при H0 и H1, уровень, мощность, p-значение (z-критерий).
import { createView, drawGrid, theme, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { jStat } from '../core/mathx.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'test',
  params: {
    tail: ['enum', 'two', 'two | left | right'],
    sl: ['sliders', null, 'слайдеры alpha, d, n: [min, max, начало, шаг]'],
    obs: ['E', null, 'наблюдаемая статистика: закрашивается p-значение'],
    show: ['str[]', ['alpha', 'power'], 'alpha, beta, power, p'],
  },
  out: ['alpha', 'beta', 'power', 'n', 'd', 'p'],
};

const DEFAULTS = { alpha: [0.01, 0.2, 0.05, 0.01], d: [0, 1.5, 0.5, 0.05], n: [4, 100, 25, 1] };

export function controls(params) {
  const sl = { ...DEFAULTS, ...(params.sl ?? {}) };
  return ['alpha', 'd', 'n'].map((k) => sliderSpec(k, sl[k]));
}

export function initial(params) {
  return Object.fromEntries(controls(params).map((c) => [c.name, c.start]));
}

const cdf = (x) => jStat.normal.cdf(x, 0, 1);
const inv = (p) => jStat.normal.inv(p, 0, 1);

/** Критические значения, мощность и p для z-критерия: Z ~ N(0,1) при H0 и N(δ,1) при H1, δ = d·√n. */
export function analyze(tail, alpha, d, n, obs) {
  const delta = d * Math.sqrt(n);
  let crit; // [lo, hi]
  let power;
  let p = NaN;
  if (tail === 'left') {
    const c = inv(alpha);
    crit = [c, Infinity];
    power = cdf(c + delta);
    if (obs !== undefined) p = cdf(obs);
  } else if (tail === 'right') {
    const c = inv(1 - alpha);
    crit = [-Infinity, c];
    power = 1 - cdf(c - delta);
    if (obs !== undefined) p = 1 - cdf(obs);
  } else {
    const c = inv(1 - alpha / 2);
    crit = [-c, c];
    power = cdf(-c - delta) + 1 - cdf(c - delta);
    if (obs !== undefined) p = 2 * (1 - cdf(Math.abs(obs)));
  }
  return { delta, crit, power, beta: 1 - power, p };
}

export function compute(params, scope, vars) {
  const obs = params.obs !== undefined ? Number(params.obs) : undefined;
  const a = analyze(params.tail ?? 'two', vars.alpha, vars.d, vars.n, obs);
  const r = (x) => Number(x.toFixed(6));
  return { alpha: vars.alpha, d: vars.d, n: vars.n, power: r(a.power), beta: r(a.beta), p: Number.isFinite(a.p) ? r(a.p) : 0 };
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const v = createView(el, { xr: [-6, 8], yr: [0, 0.45], aspect: 0.6, onResize: () => draw() });
  let vars = initial(params);
  const show = new Set(params.show ?? ['alpha', 'power']);
  const draw = () => {
    drawGrid(v, th);
    const { ctx: c } = v;
    const tail = params.tail ?? 'two';
    const a = analyze(tail, vars.alpha, vars.d, vars.n, params.obs !== undefined ? Number(params.obs) : undefined);
    const dens = (x, m) => Math.exp(-0.5 * (x - m) ** 2) / Math.sqrt(2 * Math.PI);
    const fillRegion = (m, test, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(v.X(-6), v.Y(0));
      for (let i = 0; i <= 280; i++) {
        const x = -6 + (14 * i) / 280;
        c.lineTo(v.X(x), v.Y(test(x) ? dens(x, m) : 0));
      }
      c.lineTo(v.X(8), v.Y(0));
      c.closePath();
      c.fill();
    };
    const rej = (x) => x <= a.crit[0] || x >= a.crit[1];
    if (show.has('alpha')) fillRegion(0, (x) => rej(x), th.bad + '66');
    if (show.has('power')) fillRegion(a.delta, (x) => rej(x), th.ok + '55');
    if (show.has('beta')) fillRegion(a.delta, (x) => !rej(x), th.accent + '44');
    for (const [m, col] of [[0, th.muted], [a.delta, th.accent]]) {
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      c.beginPath();
      for (let i = 0; i <= 280; i++) {
        const x = -6 + (14 * i) / 280;
        i ? c.lineTo(v.X(x), v.Y(dens(x, m))) : c.moveTo(v.X(x), v.Y(dens(x, m)));
      }
      c.stroke();
    }
    c.strokeStyle = th.fg;
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    for (const x of a.crit) {
      if (!Number.isFinite(x)) continue;
      c.beginPath();
      c.moveTo(v.X(x), v.Y(0));
      c.lineTo(v.X(x), v.Y(0.4));
      c.stroke();
    }
    c.setLineDash([]);
    if (params.obs !== undefined) {
      c.strokeStyle = th.bad;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(v.X(Number(params.obs)), v.Y(0));
      c.lineTo(v.X(Number(params.obs)), v.Y(0.42));
      c.stroke();
    }
    const parts = [];
    if (show.has('alpha')) parts.push(`α = ${fmtNum(Number(vars.alpha.toFixed(3)))}`);
    if (show.has('power')) parts.push(`мощность ${fmtNum(Number(a.power.toFixed(3)))}`);
    if (show.has('beta')) parts.push(`β = ${fmtNum(Number(a.beta.toFixed(3)))}`);
    if (show.has('p') && Number.isFinite(a.p)) parts.push(`p = ${fmtNum(Number(a.p.toFixed(4)))}`);
    label(v, parts.join(', '), 8, 18, th.fg);
    label(v, 'серая — H₀, синяя — H₁', 8, v.h - 8, th.muted);
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
