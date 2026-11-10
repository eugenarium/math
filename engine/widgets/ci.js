// @ts-check
// Доверительные интервалы по повторным выборкам: серия интервалов, промахи выделены, счётчики накапливаются.
import { createView, theme, drawGrid, label, ASPECT } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { makeRng } from '../core/rng.js';
import { jStat } from '../core/mathx.js';
import { makeDist } from './dist.js';
import { evalParam, scopeVars, sliderSpec, unionOverSliders } from './kit.js';

export const meta = {
  name: 'ci',
  params: {
    d: ['enum', 'norm', 'распределение генеральной совокупности, как в dist'],
    p: ['obj', null, 'параметры распределения, как в dist (для kind: prop — {p: доля})'],
    n: ['range', [5, 100, 25], 'объём выборки: число или слайдер [min, max, начало]'],
    level: ['range', 0.95, 'уровень доверия: число или слайдер [min, max, начало]'],
    kind: ['enum', 'z', 'z (σ известна) | t | prop (доля, интервал Вальда)'],
  },
  out: ['runs', 'cover', 'level', 'n', 'fp'],
};

const SHOWN = 100; // сколько последних интервалов рисуем

const isSlider = (a) => Array.isArray(a) && a.length >= 2;

export function controls(params) {
  const c = [];
  if (isSlider(params.n ?? [5, 100, 25])) {
    const [min, max, start = min] = params.n ?? [5, 100, 25];
    c.push({ name: 'n', type: 'slider', min, max, start, step: 1 });
  }
  if (isSlider(params.level)) c.push(sliderSpec('level', params.level.length >= 4 ? params.level : [...params.level.slice(0, 3), 0.01].slice(0, 4)));
  c.push({ name: 'run', type: 'actions', actions: [{ label: '+1', k: 1 }, { label: '+100', k: 100 }, { label: '+1000', k: 1000 }] });
  return c;
}

export function initial(params) {
  const vars = { runs: 0, cover: 0 };
  if (isSlider(params.n ?? [5, 100, 25])) {
    const [min, , start = min] = params.n ?? [5, 100, 25];
    vars.n = start;
  }
  if (isSlider(params.level)) vars.level = params.level[2] ?? params.level[0];
  return vars;
}

/** Значения n и level и распределение при текущих слайдерах. */
function setup(params, scope, vars) {
  const sc = { ...scope, ...scopeVars(vars) };
  const n = isSlider(params.n ?? [5, 100, 25]) ? vars.n : evalParam(params.n, sc);
  const level = isSlider(params.level) ? vars.level : evalParam(params.level ?? 0.95, sc);
  const kind = params.kind ?? 'z';
  const pv = {};
  for (const [k, v] of Object.entries(params.p ?? {})) pv[k] = evalParam(v, sc);
  const dist = kind === 'prop' ? null : makeDist(params.d ?? 'norm', pv);
  const truth = kind === 'prop' ? pv.p : dist.mean;
  return { n: Math.round(n), level, kind, pv, dist, truth };
}

/** Один интервал по новой выборке. */
export function oneInterval(S, rng) {
  const { n, level, kind, dist } = S;
  if (kind === 'prop') {
    let x = 0;
    for (let i = 0; i < n; i++) if (rng.next() < S.pv.p) x++;
    const ph = x / n;
    const z = jStat.normal.inv((1 + level) / 2, 0, 1);
    const h = z * Math.sqrt((ph * (1 - ph)) / n);
    return { lo: ph - h, hi: ph + h, center: ph };
  }
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < n; i++) {
    const u = Math.min(1 - 1e-12, Math.max(1e-12, rng.next()));
    const x = dist.inv(u);
    sum += x;
    sum2 += x * x;
  }
  const mean = sum / n;
  let h;
  if (kind === 't') {
    const s = Math.sqrt(Math.max(0, (sum2 - n * mean * mean) / (n - 1)));
    h = jStat.studentt.inv((1 + level) / 2, n - 1) * (s / Math.sqrt(n));
  } else h = jStat.normal.inv((1 + level) / 2, 0, 1) * (dist.sd / Math.sqrt(n));
  return { lo: mean - h, hi: mean + h, center: mean };
}

/** Серия из count интервалов: интервалы и число накрывших параметр. */
export function simulate(params, scope, vars, rng, count) {
  const S = setup(params, scope, vars);
  const intervals = [];
  let cover = 0;
  for (let i = 0; i < count; i++) {
    const iv = oneInterval(S, rng);
    iv.cover = iv.lo <= S.truth && S.truth <= iv.hi;
    if (iv.cover) cover++;
    intervals.push(iv);
  }
  return { intervals, cover, truth: S.truth };
}

export function compute(params, scope, vars) {
  const S = setup(params, scope, vars);
  const out = { runs: vars.runs ?? 0, cover: vars.cover ?? 0, n: S.n, level: S.level };
  return out;
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const rng = makeRng((Date.now() & 0x7fffffff) || 1);
  let vars = initial(params);
  let shown = []; // последние SHOWN интервалов
  let lastKey = '';

  // окно по x: истинное значение ± (z + 3) · SE при самых малых n и самом высоком уровне
  const wins = unionOverSliders({ controls, initial }, params, scope, (v) => {
    const S = setup(params, scope, v);
    const se = S.kind === 'prop' ? Math.sqrt((S.truth * (1 - S.truth)) / S.n) : S.dist.sd / Math.sqrt(S.n);
    const z = jStat.normal.inv((1 + Math.min(0.995, S.level)) / 2, 0, 1);
    return { c: S.truth, w: (z + 3) * se };
  });
  const c0 = wins[0].c;
  const half = Math.max(...wins.map((w) => w.w));
  const xr = [c0 - half, c0 + half];
  const yr = [0, SHOWN + 2];
  let v;

  const draw = () => {
    const S = setup(params, scope, vars);
    drawGrid(v, th);
    const c = v.ctx;
    c.strokeStyle = th.fg;
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.moveTo(v.X(S.truth), 0);
    c.lineTo(v.X(S.truth), v.h);
    c.stroke();
    c.setLineDash([]);
    const rowH = v.h / (SHOWN + 2);
    shown.forEach((iv, i) => {
      const y = v.h - (i + 1) * rowH;
      c.strokeStyle = iv.cover ? th.accent + 'cc' : th.bad;
      c.lineWidth = iv.cover ? 1.4 : 2.2;
      c.beginPath();
      c.moveTo(v.X(iv.lo), y);
      c.lineTo(v.X(iv.hi), y);
      c.stroke();
    });
    const runs = vars.runs ?? 0;
    const pc = runs ? ` (${fmtNum(Number(((100 * vars.cover) / runs).toFixed(1)))} %)` : '';
    label(v, `накрыли ${vars.cover} из ${runs}${pc}`, 10, 18, th.fg);
  };

  v = createView(el, { xr, yr, aspect: ASPECT.l, onResize: draw });

  const reset = () => {
    shown = [];
    vars = { ...vars, runs: 0, cover: 0 };
  };

  return {
    update(next) {
      const key = `${next.n ?? vars.n}|${next.level ?? vars.level}`;
      if (lastKey && key !== lastKey) {
        // сменили n или уровень: счётчики начинаются заново
        lastKey = key;
        reset();
        vars = { ...vars, ...Object.fromEntries(Object.entries(next).filter(([k]) => k === 'n' || k === 'level')) };
        ctx.onChange?.({ runs: 0, cover: 0 });
      } else {
        lastKey = key;
        vars = { ...vars, ...next };
      }
      draw();
    },
    /** Нажатие кнопки серии: «+1», «+100», «+1000». */
    act(name, action) {
      if (name !== 'run') return;
      const res = simulate(params, scope, vars, rng, action.k);
      shown = [...shown, ...res.intervals].slice(-SHOWN);
      vars = { ...vars, runs: (vars.runs ?? 0) + action.k, cover: (vars.cover ?? 0) + res.cover };
      draw();
      ctx.onChange?.({ runs: vars.runs, cover: vars.cover });
    },
    destroy() {
      v.destroy();
    },
  };
}
