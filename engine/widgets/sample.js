// @ts-check
// Выборки: многократное извлечение, гистограмма статистики (среднее и др.), нормальная кривая по ЦПТ.
import { createView, drawGrid, theme, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'sample',
  params: {
    d: ['enum', 'dice', 'dice | coin | exp | unif | skew — генеральная совокупность'],
    p: ['N', 0.5, 'coin: вероятность единицы; exp: интенсивность'],
    n: ['range', [1, 100, 5], 'объём выборки: [min, max, начало]'],
    stat: ['enum', 'mean', 'mean | sum | median | max | var | sd'],
    mode: ['enum', 'clt', 'clt — гистограмма статистики; lln — траектория накопленного среднего'],
  },
  out: ['runs', 'm', 's', 'last', 'n'],
};

/** Моменты совокупности: mean, sd; и генератор значения. */
export function population(params) {
  const d = params.d ?? 'dice';
  const p = params.p ?? (d === 'exp' ? 1 : 0.5);
  switch (d) {
    case 'coin': return { mean: p, sd: Math.sqrt(p * (1 - p)), draw: (r) => (r() < p ? 1 : 0) };
    case 'exp': return { mean: 1 / p, sd: 1 / p, draw: (r) => -Math.log(1 - r()) / p };
    case 'unif': return { mean: 0.5, sd: Math.sqrt(1 / 12), draw: (r) => r() };
    case 'skew': return { mean: 1.2, sd: Math.sqrt(0.56), draw: (r) => { const u = r(); return u < 0.7 ? 0 : u < 0.9 ? 2 : 5; } };
    default: return { mean: 3.5, sd: Math.sqrt(35 / 12), draw: (r) => 1 + Math.floor(r() * 6) };
  }
}

const STATS = {
  mean: (a) => a.reduce((s, x) => s + x, 0) / a.length,
  sum: (a) => a.reduce((s, x) => s + x, 0),
  median: (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; },
  max: (a) => Math.max(...a),
  var: (a) => { const m = STATS.mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1); },
  sd: (a) => Math.sqrt(STATS.var(a)),
};
export const statOf = (name, a) => (STATS[name] ?? STATS.mean)(a);

const nspec = (params) => {
  const [mn, mx, st = mn] = params.n ?? [1, 100, 5];
  return sliderSpec('n', [mn, mx, st, 1]);
};

export function controls(params) {
  return [nspec(params), { name: 'run', type: 'actions', actions: [{ label: '+1', k: 1 }, { label: '+10', k: 10 }, { label: '+1000', k: 1000 }] }];
}

export function initial(params) {
  return { n: nspec(params).start, runs: 0, m: 0, s: 0, last: 0 };
}

export function compute(params, scope, vars) {
  return { runs: vars.runs ?? 0, m: vars.m ?? 0, s: vars.s ?? 0, last: vars.last ?? 0, n: vars.n };
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const pop = population(params);
  const stat = params.stat ?? 'mean';
  const mode = params.mode ?? 'clt';
  let vars = initial(params);
  let values = [];
  const traj = [];
  let sumAll = 0;
  let cnt = 0;
  const r = Math.random;
  const v = createView(el, { xr: [0, 1], yr: [0, 1], aspect: 0.7, onResize: () => draw() });
  const range = () => {
    const se = pop.sd / Math.sqrt(vars.n);
    if (stat === 'mean') return [pop.mean - 4 * pop.sd / Math.sqrt(Math.max(1, vars.n)) - 1e-9, pop.mean + 4 * pop.sd / Math.sqrt(Math.max(1, vars.n)) + 1e-9, se];
    const vs = values.length ? values : [pop.mean];
    const lo = Math.min(...vs), hi = Math.max(...vs);
    return [lo - 0.5, hi + 0.5, se];
  };
  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    const o = values.length;
    if (mode === 'lln') {
      v.xr = [0, Math.max(10, traj.length)];
      v.yr = [pop.mean - 2 * pop.sd, pop.mean + 2 * pop.sd];
      drawGrid(v, th);
      c.strokeStyle = th.muted;
      c.setLineDash([5, 4]);
      c.beginPath();
      c.moveTo(0, v.Y(pop.mean));
      c.lineTo(w, v.Y(pop.mean));
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = th.accent;
      c.lineWidth = 2.5;
      c.beginPath();
      traj.forEach((y, i) => (i ? c.lineTo(v.X(i + 1), v.Y(y)) : c.moveTo(v.X(1), v.Y(y))));
      c.stroke();
      label(v, `среднее после ${traj.length} набл., μ = ${fmtNum(Number(pop.mean.toFixed(3)))}`, 8, 18, th.fg);
      return;
    }
    const [lo, hi, se] = range();
    const bins = 24;
    const counts = new Array(bins).fill(0);
    for (const x of values) {
      const k = Math.floor(((x - lo) / (hi - lo)) * bins);
      if (k >= 0 && k < bins) counts[k]++;
    }
    const maxc = Math.max(1, ...counts);
    const top = 34;
    const bottom = h - 26;
    c.fillStyle = th.accent + 'aa';
    counts.forEach((cn, k) => {
      const x0 = (k / bins) * w;
      const bh = (cn / maxc) * (bottom - top);
      c.fillRect(x0 + 1, bottom - bh, w / bins - 2, bh);
    });
    c.strokeStyle = th.fg;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, bottom);
    c.lineTo(w, bottom);
    c.stroke();
    if (stat === 'mean' && o > 0) {
      // нормальная кривая N(μ, σ²/n) в масштабе гистограммы
      c.strokeStyle = th.bad;
      c.lineWidth = 2.5;
      c.beginPath();
      const binW = (hi - lo) / bins;
      for (let px = 0; px <= w; px += 3) {
        const x = lo + (px / w) * (hi - lo);
        const dens = Math.exp(-0.5 * ((x - pop.mean) / se) ** 2) / (se * Math.sqrt(2 * Math.PI));
        const y = bottom - ((dens * binW * o) / maxc) * (bottom - top);
        px ? c.lineTo(px, y) : c.moveTo(px, y);
      }
      c.stroke();
    }
    c.fillStyle = th.fg;
    c.font = '12px system-ui, sans-serif';
    c.textAlign = 'center';
    for (let i = 0; i <= 4; i++) c.fillText(fmtNum(Number((lo + ((hi - lo) * i) / 4).toPrecision(3))), (w * i) / 4 + (i === 0 ? 14 : i === 4 ? -14 : 0), h - 8);
    label(v, `серий: ${o}${o ? `, среднее ${fmtNum(Number(vars.m.toPrecision(4)))}, σ ${fmtNum(Number(vars.s.toPrecision(3)))}` : ''}, n = ${vars.n}`, 8, 18, th.fg);
  };
  draw();
  return {
    update(next) {
      const changed = next.n !== undefined && next.n !== vars.n;
      vars = { ...vars, ...next };
      if (changed) {
        values = [];
        traj.length = 0;
        sumAll = 0;
        cnt = 0;
        vars = { ...vars, runs: 0, m: 0, s: 0, last: 0 };
        ctx.onChange?.({ runs: 0, m: 0, s: 0, last: 0 });
      }
      draw();
    },
    act(name, a) {
      if (name !== 'run') return;
      for (let i = 0; i < a.k; i++) {
        const sample = Array.from({ length: vars.n }, () => pop.draw(r));
        const val = statOf(stat, sample);
        values.push(val);
        vars.last = val;
        for (const x of sample) {
          sumAll += x;
          cnt++;
          if (mode === 'lln' && traj.length < 2000) traj.push(sumAll / cnt);
        }
      }
      const m = values.reduce((s, x) => s + x, 0) / values.length;
      const s = Math.sqrt(values.reduce((q, x) => q + (x - m) ** 2, 0) / Math.max(1, values.length - 1));
      vars = { ...vars, runs: values.length, m, s };
      draw();
      ctx.onChange?.({ runs: vars.runs, m, s, last: vars.last });
    },
    destroy() {
      v.destroy();
    },
  };
}
