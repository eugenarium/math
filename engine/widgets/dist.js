// @ts-check
// Распределения: плотность или pmf, функция распределения, закрашенная вероятность с перетаскиваемыми границами, квантиль.
import { createView, theme, drawGrid, plotFn, label, ASPECT } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { jStat } from '../core/mathx.js';
import { evalParam, sliderSpec, scopeVars, unionOverSliders } from './kit.js';

const INT_PARAMS = new Set(['n', 'N', 'K', 'df', 'd1', 'd2']);
const DEFAULTS = {
  norm: { mu: 0, sigma: 1 },
  t: { df: 5 },
  chi2: { df: 4 },
  f: { d1: 5, d2: 10 },
  exp: { lam: 1 },
  unif: { a: 0, b: 1 },
  gamma: { a: 2, b: 1 },
  beta: { a: 2, b: 2 },
  binom: { n: 10, p: 0.5 },
  pois: { lam: 4 },
  geom: { p: 0.3 },
  hyper: { N: 50, K: 20, n: 10 },
};

export const meta = {
  name: 'dist',
  params: {
    d: ['enum', 'norm', 'norm | t | chi2 | f | exp | unif | gamma | beta | binom | pois | geom | hyper'],
    p: ['obj', null, 'параметры: число, выражение или слайдер [min, max, начало]'],
    show: ['str[]', ['pdf'], 'pdf, cdf'],
    area: ['E[]', null, 'закрашенная вероятность между a и b; границы перетаскиваются'],
    q: ['E', null, 'отметить квантиль уровня q'],
    marks: ['str[]', null, 'mean, sd, median'],
  },
  out: ['a', 'b', 'P'],
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * Распределение по имени и параметрам: pdf, cdf, inv (квантиль), mean, sd, дискретность, окно.
 * Для дискретных P(a, b) = F(b) − F(a), то есть P(a < X ≤ b).
 */
export function makeDist(d, p) {
  const th = { discrete: false, inv: null, mean: NaN, sd: NaN };
  switch (d) {
    case 'norm':
      return { ...th, pdf: (x) => jStat.normal.pdf(x, p.mu, p.sigma), cdf: (x) => jStat.normal.cdf(x, p.mu, p.sigma), inv: (q) => jStat.normal.inv(q, p.mu, p.sigma), mean: p.mu, sd: p.sigma, lo: p.mu - 4 * p.sigma, hi: p.mu + 4 * p.sigma };
    case 't': {
      const w = Math.min(12, Math.max(4, jStat.studentt.inv(0.9995, p.df)));
      return { ...th, pdf: (x) => jStat.studentt.pdf(x, p.df), cdf: (x) => jStat.studentt.cdf(x, p.df), inv: (q) => jStat.studentt.inv(q, p.df), mean: p.df > 1 ? 0 : NaN, sd: p.df > 2 ? Math.sqrt(p.df / (p.df - 2)) : NaN, lo: -w, hi: w };
    }
    case 'chi2':
      return { ...th, pdf: (x) => jStat.chisquare.pdf(x, p.df), cdf: (x) => jStat.chisquare.cdf(x, p.df), inv: (q) => jStat.chisquare.inv(q, p.df), mean: p.df, sd: Math.sqrt(2 * p.df), lo: 0, hi: jStat.chisquare.inv(0.999, p.df) };
    case 'f':
      return { ...th, pdf: (x) => jStat.centralF.pdf(x, p.d1, p.d2), cdf: (x) => jStat.centralF.cdf(x, p.d1, p.d2), inv: (q) => jStat.centralF.inv(q, p.d1, p.d2), mean: p.d2 > 2 ? p.d2 / (p.d2 - 2) : NaN, sd: p.d2 > 4 ? Math.sqrt((2 * p.d2 * p.d2 * (p.d1 + p.d2 - 2)) / (p.d1 * (p.d2 - 2) ** 2 * (p.d2 - 4))) : NaN, lo: 0, hi: Math.min(jStat.centralF.inv(0.99, p.d1, p.d2), 10) };
    case 'exp':
      return { ...th, pdf: (x) => (x < 0 ? 0 : p.lam * Math.exp(-p.lam * x)), cdf: (x) => (x < 0 ? 0 : 1 - Math.exp(-p.lam * x)), inv: (q) => -Math.log(1 - q) / p.lam, mean: 1 / p.lam, sd: 1 / p.lam, lo: 0, hi: -Math.log(0.001) / p.lam };
    case 'unif': {
      const w = p.b - p.a;
      return { ...th, pdf: (x) => (x >= p.a && x <= p.b ? 1 / w : 0), cdf: (x) => clamp((x - p.a) / w, 0, 1), inv: (q) => p.a + q * w, mean: (p.a + p.b) / 2, sd: w / Math.sqrt(12), lo: p.a - 0.25 * w, hi: p.b + 0.25 * w };
    }
    case 'gamma':
      return { ...th, pdf: (x) => (x < 0 ? 0 : jStat.gamma.pdf(x, p.a, 1 / p.b)), cdf: (x) => (x < 0 ? 0 : jStat.gamma.cdf(x, p.a, 1 / p.b)), inv: (q) => jStat.gamma.inv(q, p.a, 1 / p.b), mean: p.a / p.b, sd: Math.sqrt(p.a) / p.b, lo: 0, hi: jStat.gamma.inv(0.999, p.a, 1 / p.b) };
    case 'beta':
      return { ...th, pdf: (x) => (x < 0 || x > 1 ? 0 : jStat.beta.pdf(x, p.a, p.b)), cdf: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : jStat.beta.cdf(x, p.a, p.b)), inv: (q) => jStat.beta.inv(q, p.a, p.b), mean: p.a / (p.a + p.b), sd: Math.sqrt((p.a * p.b) / ((p.a + p.b) ** 2 * (p.a + p.b + 1))), lo: 0, hi: 1 };
    case 'binom':
      return discrete((k) => jStat.binomial.pdf(k, p.n, p.p), (k) => jStat.binomial.cdf(k, p.n, p.p), p.n * p.p, Math.sqrt(p.n * p.p * (1 - p.p)), 0, p.n);
    case 'pois':
      return discrete((k) => jStat.poisson.pdf(k, p.lam), (k) => jStat.poisson.cdf(k, p.lam), p.lam, Math.sqrt(p.lam), 0, Math.ceil(p.lam + 5 * Math.sqrt(p.lam) + 3));
    case 'geom':
      return discrete((k) => (k < 1 ? 0 : (1 - p.p) ** (k - 1) * p.p), (k) => (k < 1 ? 0 : 1 - (1 - p.p) ** Math.floor(k)), 1 / p.p, Math.sqrt(1 - p.p) / p.p, 0, Math.min(40, Math.ceil(Math.log(0.001) / Math.log(1 - p.p)) + 1));
    case 'hyper': {
      const lo = Math.max(0, p.n + p.K - p.N);
      const hi = Math.min(p.n, p.K);
      return discrete((k) => jStat.hypgeom.pdf(k, p.N, p.K, p.n), (k) => jStat.hypgeom.cdf(k, p.N, p.K, p.n), (p.n * p.K) / p.N, Math.sqrt(((p.n * p.K * (p.N - p.K) * (p.N - p.n)) / (p.N * p.N * (p.N - 1)))), lo, hi);
    }
    default:
      throw new Error('dist: неизвестное распределение ' + d);
  }
}

function discrete(pmf, cdf, mean, sd, lo, hi) {
  const F = (x) => (x < lo ? 0 : cdf(Math.min(Math.floor(x + 1e-9), hi)));
  return {
    discrete: true,
    pdf: (k) => (Number.isInteger(k) && k >= lo && k <= hi ? pmf(k) : 0),
    cdf: F,
    inv: (q) => {
      for (let k = lo; k <= hi; k++) if (F(k) >= q - 1e-12) return k;
      return hi;
    },
    mean,
    sd,
    lo,
    hi,
  };
}

/** Параметры распределения: константы и слайдеры. */
function paramSpecs(params) {
  const d = params.d ?? 'norm';
  return { ...DEFAULTS[d], ...(params.p ?? {}) };
}

export function controls(params) {
  return Object.entries(paramSpecs(params))
    .filter(([, a]) => Array.isArray(a) && a.length >= 2 && typeof a[0] === 'number')
    .map(([name, a]) => {
      const spec = sliderSpec(name, a);
      return INT_PARAMS.has(name) ? { ...spec, step: Math.max(1, Math.round(spec.step)) } : spec;
    });
}

function paramValues(params, scope, vars) {
  const sc = { ...scope, ...scopeVars(vars) };
  /** @type {Record<string, number>} */
  const p = {};
  for (const [k, a] of Object.entries(paramSpecs(params))) p[k] = Array.isArray(a) && typeof a[0] === 'number' ? vars[k] : evalParam(a, sc);
  return p;
}

export function initial(params, scope = {}) {
  const vars = {};
  for (const c of controls(params)) vars[c.name] = c.start;
  if (params.area) {
    const [a, b] = evalParam(params.area, { ...scope, ...vars });
    vars.a = a;
    vars.b = b;
  }
  return vars;
}

export function compute(params, scope, vars) {
  const dist = makeDist(params.d ?? 'norm', paramValues(params, scope, vars));
  const out = {};
  for (const [k, v] of Object.entries(vars)) if (typeof v === 'number') out[k] = v;
  if (params.area) out.P = dist.cdf(vars.b) - dist.cdf(vars.a);
  return out;
}

/** Окно по x и верхняя граница по y — объединение по крайним значениям слайдеров. */
function windowOf(params, scope) {
  const sets = unionOverSliders({ controls, initial }, params, scope, (v) => {
    const dist = makeDist(params.d ?? 'norm', paramValues(params, scope, v));
    let ymax = 0;
    if (dist.discrete) for (let k = dist.lo; k <= dist.hi; k++) ymax = Math.max(ymax, dist.pdf(k));
    else for (let i = 0; i <= 200; i++) ymax = Math.max(ymax, dist.pdf(dist.lo + ((dist.hi - dist.lo) * i) / 200) || 0);
    return { lo: dist.lo, hi: dist.hi, ymax: Math.min(ymax, 1e3) };
  });
  return { lo: Math.min(...sets.map((s) => s.lo)), hi: Math.max(...sets.map((s) => s.hi)), ymax: Math.max(...sets.map((s) => s.ymax)) };
}

/** Оси перебора границ a и b для проверки достижимости цели. */
export function dragAxes(params, scope) {
  if (!params.area) return [];
  const { lo, hi } = windowOf(params, scope);
  const grid = Array.from({ length: 161 }, (_, i) => lo + ((hi - lo) * i) / 160);
  return [grid.map((a) => ({ a })), grid.map((b) => ({ b }))];
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  let vars = initial(params, scope);
  const win = windowOf(params, scope);
  const show = params.show ?? ['pdf'];
  const cdfOnly = show.includes('cdf') && !show.includes('pdf');
  const pad = (win.hi - win.lo) * 0.04;
  const xr = [win.lo - pad, win.hi + pad];
  const yr = cdfOnly ? [-0.05, 1.08] : [-win.ymax * 0.04, win.ymax * 1.25 || 1];
  let v;

  const draw = () => {
    const dist = makeDist(params.d ?? 'norm', paramValues(params, scope, vars));
    drawGrid(v, th);
    const c = v.ctx;
    const scaleCdf = cdfOnly ? 1 : win.ymax;

    // закрашенная область
    if (params.area) {
      const a = Math.min(vars.a, vars.b);
      const b = Math.max(vars.a, vars.b);
      c.fillStyle = th.accent + '44';
      if (dist.discrete) {
        for (let k = Math.max(dist.lo, Math.floor(a) + 1); k <= Math.min(dist.hi, Math.floor(b)); k++) c.fillRect(v.X(k - 0.4), v.Y(dist.pdf(k)), v.X(k + 0.4) - v.X(k - 0.4), v.Y(0) - v.Y(dist.pdf(k)));
      } else if (!cdfOnly) {
        c.beginPath();
        c.moveTo(v.X(a), v.Y(0));
        for (let i = 0; i <= 120; i++) {
          const x = a + ((b - a) * i) / 120;
          c.lineTo(v.X(x), v.Y(dist.pdf(x) || 0));
        }
        c.lineTo(v.X(b), v.Y(0));
        c.closePath();
        c.fill();
      }
    }

    if (!cdfOnly) {
      if (dist.discrete) {
        c.fillStyle = th.accent + '99';
        for (let k = dist.lo; k <= dist.hi; k++) {
          const y = dist.pdf(k);
          c.fillRect(v.X(k - 0.4), v.Y(y), v.X(k + 0.4) - v.X(k - 0.4), v.Y(0) - v.Y(y));
        }
      } else plotFn(v, (x) => dist.pdf(x), th.accent, 2.8);
    }
    if (show.includes('cdf')) {
      if (dist.discrete) plotFn(v, (x) => dist.cdf(x) * scaleCdf, th.bad, 2.2);
      else plotFn(v, (x) => dist.cdf(x) * scaleCdf, th.bad, 2.2);
    }

    // метки
    const marks = params.marks ?? [];
    const vline = (x, color, dash = [5, 4]) => {
      c.strokeStyle = color;
      c.lineWidth = 1.6;
      c.setLineDash(dash);
      c.beginPath();
      c.moveTo(v.X(x), 0);
      c.lineTo(v.X(x), v.h);
      c.stroke();
      c.setLineDash([]);
    };
    if (marks.includes('mean') && Number.isFinite(dist.mean)) vline(dist.mean, th.ok);
    if (marks.includes('median') && dist.inv) vline(dist.inv(0.5), th.muted);
    if (marks.includes('sd') && Number.isFinite(dist.sd) && Number.isFinite(dist.mean)) {
      vline(dist.mean - dist.sd, th.ok, [2, 4]);
      vline(dist.mean + dist.sd, th.ok, [2, 4]);
    }
    if (params.q !== undefined && dist.inv) {
      const qp = evalParam(params.q, { ...scope, ...scopeVars(vars) });
      const xq = dist.inv(qp);
      vline(xq, th.bad);
      label(v, `квантиль ${fmtNum(Number(qp.toPrecision(3)))}: ${fmtNum(Number(xq.toPrecision(4)))}`, 10, v.h - 10, th.fg);
    }

    if (params.area) {
      const a = Math.min(vars.a, vars.b);
      const b = Math.max(vars.a, vars.b);
      for (const x of [a, b]) {
        vline(x, th.fg, []);
        dot(v, x, yr[0] * 0 + 0, th.fg, 8);
      }
      const P = dist.cdf(b) - dist.cdf(a);
      label(v, `P = ${fmtNum(Number(P.toPrecision(4)))}   a = ${fmtNum(Number(a.toPrecision(3)))}   b = ${fmtNum(Number(b.toPrecision(3)))}`, 10, 18, th.fg);
    }
  };

  function dot(view, x, y, color, r) {
    view.ctx.fillStyle = color;
    view.ctx.beginPath();
    view.ctx.arc(view.X(x), view.Y(y), r, 0, Math.PI * 2);
    view.ctx.fill();
  }

  v = createView(el, { xr, yr, aspect: ASPECT.m, onResize: draw });

  if (params.area) {
    v.canvas.style.touchAction = 'none';
    let which = null;
    const move = (e) => {
      const [px] = v.pos(e);
      let x = clamp(v.ix(px), win.lo, win.hi);
      if (v && ctxIsDiscrete()) x = Math.round(x);
      vars = { ...vars, [which]: x };
      draw();
      ctx.onChange?.({ [which]: x });
    };
    const ctxIsDiscrete = () => makeDist(params.d ?? 'norm', paramValues(params, scope, vars)).discrete;
    v.canvas.addEventListener('pointerdown', (e) => {
      const [px] = v.pos(e);
      const da = Math.abs(px - v.X(vars.a));
      const db = Math.abs(px - v.X(vars.b));
      if (Math.min(da, db) > 36) return;
      which = da <= db ? 'a' : 'b';
      v.canvas.setPointerCapture(e.pointerId);
    });
    v.canvas.addEventListener('pointermove', (e) => which && move(e));
    v.canvas.addEventListener('pointerup', () => (which = null));
    v.canvas.addEventListener('pointercancel', () => (which = null));
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
