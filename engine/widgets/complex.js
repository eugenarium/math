// @ts-check
// Комплексная плоскость: перетаскиваемые точки, модуль и аргумент, сумма, произведение, сопряжённое, корни и степень.
import { createView, theme, drawGrid, dot, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalParam } from './kit.js';

export const meta = {
  name: 'complex',
  params: {
    z: ['obj', null, 'точки: {z: [re, im], w: [re, im]}; перетаскиваются'],
    lock: ['str[]', null, 'имена точек, которые нельзя двигать'],
    show: ['str[]', null, 'polar, sum, prod, conj, roots:n, pow:n'],
    win: ['range', [-4, 4], 'окно по обеим осям'],
  },
  out: ['z.re', 'z.im', 'z.abs', 'z.arg', 'w.re', 'w.im', 'w.abs', 'w.arg'],
};

const STEP = 0.5; // привязка при перетаскивании

export function controls() {
  return [];
}

const names = (params) => Object.keys(params.z ?? {});

export function initial(params, scope = {}) {
  const vars = {};
  for (const [k, p] of Object.entries(params.z ?? {})) {
    const [re, im] = evalParam(p, scope);
    vars[`${k}.re`] = re;
    vars[`${k}.im`] = im;
  }
  return vars;
}

const arg = (re, im) => (re === 0 && im === 0 ? 0 : Math.atan2(im, re));

export function compute(params, _scope, vars) {
  const out = {};
  for (const k of names(params)) {
    const re = vars[`${k}.re`];
    const im = vars[`${k}.im`];
    out[`${k}.re`] = re;
    out[`${k}.im`] = im;
    out[`${k}.abs`] = Math.hypot(re, im);
    out[`${k}.arg`] = arg(re, im);
  }
  return out;
}

/** Оси перебора: для каждой незафиксированной точки — сетка по Re и по Im. */
export function dragAxes(params) {
  const [lo, hi] = params.win ?? [-4, 4];
  const grid = [];
  for (let x = lo; x <= hi + 1e-9; x += STEP) grid.push(Number(x.toFixed(6)));
  const axes = [];
  for (const k of names(params)) {
    if (params.lock?.includes(k)) continue;
    axes.push(grid.map((re) => ({ [`${k}.re`]: re })), grid.map((im) => ({ [`${k}.im`]: im })));
  }
  return axes;
}

const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const [lo, hi] = params.win ?? [-4, 4];
  let vars = initial(params, scope);
  const ks = names(params);
  const show = params.show ?? [];
  let v;

  const pt = (k) => [vars[`${k}.re`], vars[`${k}.im`]];
  const COLORS = [th.accent, th.bad, th.ok];

  const arrow = (to, color, width = 2.5) => {
    const c = v.ctx;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(v.X(0), v.Y(0));
    c.lineTo(v.X(to[0]), v.Y(to[1]));
    c.stroke();
  };
  const circle = (r, color) => {
    const c = v.ctx;
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.arc(v.X(0), v.Y(0), r * (v.X(1) - v.X(0)), 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  };
  const tag = (p, text, color) => {
    dot(v, p[0], p[1], color, 6);
    v.ctx.font = '600 13px system-ui, sans-serif';
    v.ctx.fillStyle = color;
    v.ctx.textAlign = 'left';
    v.ctx.fillText(text, v.X(p[0]) + 9, v.Y(p[1]) - 8);
  };

  const draw = () => {
    drawGrid(v, th);
    const c = v.ctx;
    c.font = '12px system-ui, sans-serif';
    c.fillStyle = th.muted;
    c.textAlign = 'right';
    c.fillText('Re', v.w - 6, v.Y(0) - 6);
    c.textAlign = 'left';
    c.fillText('Im', v.X(0) + 6, 14);

    const z = ks.includes('z') ? pt('z') : null;
    const w = ks.includes('w') ? pt('w') : null;

    if (z && show.includes('polar')) {
      const r = Math.hypot(z[0], z[1]);
      circle(r, th.muted);
      // дуга аргумента
      c.strokeStyle = th.ok;
      c.lineWidth = 2.5;
      c.beginPath();
      const rad = Math.min(r, 1) * (v.X(1) - v.X(0)) * 0.6 + 8;
      const a = arg(z[0], z[1]);
      c.arc(v.X(0), v.Y(0), rad, -a, 0, a > 0);
      c.stroke();
    }
    if (z && w && show.includes('sum')) {
      const s = [z[0] + w[0], z[1] + w[1]];
      plotSeg(v, w, s, th.muted);
      plotSeg(v, z, s, th.muted);
      arrow(s, th.fg, 3);
      tag(s, 'z+w', th.fg);
    }
    if (z && w && show.includes('prod')) {
      const p = mul(z, w);
      arrow(p, th.fg, 3);
      tag(p, 'zw', th.fg);
    }
    if (z && show.includes('conj')) tag([z[0], -z[1]], 'z̄', th.muted);
    for (const s of show) {
      const m = /^roots:(\d+)$/.exec(s);
      if (m && z) {
        const n = Number(m[1]);
        const r = Math.hypot(z[0], z[1]) ** (1 / n);
        const a = arg(z[0], z[1]);
        circle(r, th.line);
        for (let k = 0; k < n; k++) dot(v, r * Math.cos((a + 2 * Math.PI * k) / n), r * Math.sin((a + 2 * Math.PI * k) / n), th.ok, 6);
      }
      const q = /^pow:(\d+)$/.exec(s);
      if (q && z) {
        const n = Number(q[1]);
        const r = Math.hypot(z[0], z[1]) ** n;
        const a = arg(z[0], z[1]);
        tag([r * Math.cos(a * n), r * Math.sin(a * n)], `z^${n}`, th.fg);
      }
    }

    ks.forEach((k, i) => {
      const p = pt(k);
      arrow(p, COLORS[i % 3]);
      tag(p, k, COLORS[i % 3]);
    });

    if (ks.length) {
      const o = compute(params, scope, vars);
      const k0 = ks[0];
      const sign = o[`${k0}.im`] < 0 ? '−' : '+';
      label(
        v,
        `${k0} = ${fmtNum(o[`${k0}.re`])} ${sign} ${fmtNum(Math.abs(o[`${k0}.im`]))}i,  |${k0}| = ${fmtNum(Number(o[`${k0}.abs`].toPrecision(4)))},  arg = ${fmtNum(Number(o[`${k0}.arg`].toPrecision(3)))}`,
        10,
        18,
        th.fg,
      );
    }
  };

  v = createView(el, { xr: [lo, hi], yr: [lo, hi], aspect: 1, onResize: draw });

  const movable = ks.filter((k) => !params.lock?.includes(k));
  if (movable.length) {
    v.canvas.style.touchAction = 'none';
    let which = null;
    v.canvas.addEventListener('pointerdown', (e) => {
      const [px, py] = v.pos(e);
      let best = null;
      let bd = 40;
      for (const k of movable) {
        const d = Math.hypot(px - v.X(vars[`${k}.re`]), py - v.Y(vars[`${k}.im`]));
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (!best) return;
      which = best;
      v.canvas.setPointerCapture(e.pointerId);
    });
    v.canvas.addEventListener('pointermove', (e) => {
      if (!which) return;
      const [px, py] = v.pos(e);
      const re = Math.min(hi, Math.max(lo, Math.round(v.ix(px) / STEP) * STEP));
      const im = Math.min(hi, Math.max(lo, Math.round(v.iy(py) / STEP) * STEP));
      vars = { ...vars, [`${which}.re`]: re, [`${which}.im`]: im };
      draw();
      ctx.onChange?.({ [`${which}.re`]: re, [`${which}.im`]: im });
    });
    const end = () => (which = null);
    v.canvas.addEventListener('pointerup', end);
    v.canvas.addEventListener('pointercancel', end);
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

function plotSeg(view, a, b, color) {
  const c = view.ctx;
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.setLineDash([5, 4]);
  c.beginPath();
  c.moveTo(view.X(a[0]), view.Y(a[1]));
  c.lineTo(view.X(b[0]), view.Y(b[1]));
  c.stroke();
  c.setLineDash([]);
}
