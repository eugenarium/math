// @ts-check
// Случайные опыты: монета, кости, урна. Многократные испытания, частота события против точной вероятности.
import { createView, theme, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr } from '../core/mathx.js';

export const meta = {
  name: 'chance',
  params: {
    exp: ['enum', 'dice', 'coin | dice | urn'],
    cfg: ['obj', null, 'coin {p, n} · dice {n} · urn {r, b, draw, repl}'],
    ev: ['E', null, 'событие: coin heads · dice d1, d2, sum, hi, lo · urn red, blue'],
  },
  out: ['runs', 'freq', 'P'],
};

/** Перечисление исходов: [{переменные события, вероятность}]. */
export function outcomes(params) {
  const cfg = params.cfg ?? {};
  switch (params.exp ?? 'dice') {
    case 'coin': {
      const n = cfg.n ?? 1;
      const p = cfg.p ?? 0.5;
      const out = [];
      for (let k = 0; k <= n; k++) {
        let c = 1;
        for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
        out.push({ vars: { heads: k, tails: n - k }, pr: c * p ** k * (1 - p) ** (n - k) });
      }
      return out;
    }
    case 'urn': {
      const R = cfg.r ?? 3;
      const B = cfg.b ?? 2;
      const draw = cfg.draw ?? 2;
      const repl = !!cfg.repl;
      const out = new Map();
      const rec = (r, b, left, red, p) => {
        if (left === 0) {
          const key = red;
          out.set(key, (out.get(key) ?? 0) + p);
          return;
        }
        const tot = r + b;
        if (r > 0) rec(repl ? r : r - 1, b, left - 1, red + 1, (p * r) / tot);
        if (b > 0) rec(r, repl ? b : b - 1, left - 1, red, (p * b) / tot);
      };
      rec(R, B, draw, 0, 1);
      return [...out].map(([red, pr]) => ({ vars: { red, blue: draw - red }, pr }));
    }
    default: {
      const n = cfg.n ?? 2;
      const out = [];
      const rec = (i, ds) => {
        if (i === n) {
          out.push({ vars: { ...Object.fromEntries(ds.map((d, j) => ['d' + (j + 1), d])), sum: ds.reduce((a, b) => a + b, 0), hi: Math.max(...ds), lo: Math.min(...ds) }, pr: 1 / 6 ** n });
          return;
        }
        for (let d = 1; d <= 6; d++) rec(i + 1, [...ds, d]);
      };
      rec(0, []);
      return out;
    }
  }
}

export function exactP(params) {
  if (!params.ev) return NaN;
  return outcomes(params).reduce((s, o) => s + (evalExpr(params.ev, o.vars) === true ? o.pr : 0), 0);
}

export function controls() {
  return [{ name: 'run', type: 'actions', actions: [{ label: '+1', k: 1 }, { label: '+10', k: 10 }, { label: '+100', k: 100 }, { label: '+1000', k: 1000 }] }];
}

export function initial() {
  return { runs: 0, freq: 0, hits: 0 };
}

export function compute(params, scope, vars) {
  const P = exactP(params);
  return { runs: vars.runs ?? 0, freq: Number((vars.freq ?? 0).toFixed(6)), P: Number.isFinite(P) ? Number(P.toFixed(6)) : 0 };
}

/** Один случайный исход по таблице вероятностей. */
function pick(list, rnd) {
  let u = rnd();
  for (const o of list) {
    u -= o.pr;
    if (u <= 0) return o;
  }
  return list[list.length - 1];
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const list = outcomes(params);
  const P = exactP(params);
  let vars = initial();
  const history = [];
  const v = createView(el, { xr: [0, 1], yr: [0, 1], aspect: 0.62, onResize: () => draw() });
  const keyOf = (o) => Object.values(o.vars).join(',');
  const tally = new Map();
  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    // график частоты события по числу опытов
    const top = 30;
    const bottom = h - 22;
    c.strokeStyle = th.line;
    c.lineWidth = 1;
    for (const q of [0, 0.5, 1]) {
      c.beginPath();
      c.moveTo(0, bottom - q * (bottom - top));
      c.lineTo(w, bottom - q * (bottom - top));
      c.stroke();
    }
    if (Number.isFinite(P)) {
      c.strokeStyle = th.ok;
      c.setLineDash([6, 4]);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, bottom - P * (bottom - top));
      c.lineTo(w, bottom - P * (bottom - top));
      c.stroke();
      c.setLineDash([]);
    }
    if (history.length) {
      c.strokeStyle = th.accent;
      c.lineWidth = 2.5;
      c.beginPath();
      history.forEach((f, i) => {
        const x = (history.length === 1 ? 0.5 : i / (history.length - 1)) * w;
        const y = bottom - f * (bottom - top);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      c.stroke();
    }
    const txt = vars.runs ? `опытов ${vars.runs}, частота ${fmtNum(Number(vars.freq.toFixed(3)))}` : 'нажми «+1», «+10»…';
    label(v, txt + (Number.isFinite(P) ? `; вероятность ${fmtNum(Number(P.toFixed(3)))}` : ''), 8, 18, th.fg);
    c.fillStyle = th.fg;
    c.font = '11px system-ui, sans-serif';
    c.textAlign = 'right';
    c.fillText('1', w - 4, top - 2);
    c.fillText('0', w - 4, bottom - 3);
    // последние исходы
    const last = [...tally].slice(-0);
    void last;
    c.textAlign = 'left';
    c.fillStyle = th.muted;
    c.fillText(vars.lastText ?? '', 6, h - 6);
  };
  draw();
  return {
    update(next) {
      vars = { ...vars, ...next };
      draw();
    },
    act(name, a) {
      if (name !== 'run') return;
      let hits = vars.hits;
      let runs = vars.runs;
      let lastO = null;
      for (let i = 0; i < a.k; i++) {
        const o = pick(list, Math.random);
        lastO = o;
        runs++;
        if (!params.ev || evalExpr(params.ev, o.vars) === true) hits++;
        tally.set(keyOf(o), (tally.get(keyOf(o)) ?? 0) + 1);
        if (a.k <= 100 || i % Math.ceil(a.k / 100) === 0) history.push(hits / runs);
      }
      if (history.length > 400) history.splice(0, history.length - 400);
      const freq = hits / runs;
      vars = { ...vars, runs, hits, freq, lastText: lastO ? 'последний исход: ' + Object.entries(lastO.vars).map(([k, x]) => `${k}=${x}`).join(', ') : '' };
      draw();
      ctx.onChange?.({ runs, hits, freq });
    },
    destroy() {
      v.destroy();
    },
  };
}
