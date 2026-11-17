// @ts-check
// Векторы на плоскости: два вектора с перетаскиваемыми концами, сумма, разность, проекция, угол, скалярное произведение.
import { createView, drawGrid, theme } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalParam } from './kit.js';

export const meta = {
  name: 'vec2',
  params: {
    v: ['obj', { a: [2, 1], b: [1, 2] }, 'векторы {a: [x, y], b: [x, y]}; перетаскиваются за конец'],
    lock: ['str[]', null, 'имена зафиксированных векторов, например [b]'],
    show: ['str[]', null, 'sum, diff, proj, angle, dot, det'],
    win: ['range', [-6, 6], 'окно по обеим осям'],
  },
  out: ['a.x', 'a.y', 'b.x', 'b.y', 'dot', 'angle', 'det'],
};

export function controls() {
  return [];
}

const base = (params, scope = {}) => {
  const v = params.v ?? { a: [2, 1], b: [1, 2] };
  const a = evalParam(v.a ?? [2, 1], scope);
  const b = evalParam(v.b ?? [1, 2], scope);
  return { 'a.x': a[0], 'a.y': a[1], 'b.x': b[0], 'b.y': b[1] };
};
export const initial = base;

export function compute(params, scope, vars) {
  const ax = vars['a.x'], ay = vars['a.y'], bx = vars['b.x'], by = vars['b.y'];
  const dot = ax * bx + ay * by;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  const angle = la && lb ? (Math.acos(Math.max(-1, Math.min(1, dot / (la * lb)))) * 180) / Math.PI : 0;
  return { 'a.x': ax, 'a.y': ay, 'b.x': bx, 'b.y': by, dot, angle: Number(angle.toFixed(6)), det: ax * by - ay * bx };
}

export function dragAxes(params) {
  const [lo, hi] = params.win ?? [-6, 6];
  const grid = [];
  for (let x = lo; x <= hi; x++) grid.push(x);
  const locked = new Set(params.lock ?? []);
  const axes = [];
  for (const n of ['a', 'b']) {
    if (locked.has(n)) continue;
    axes.push(grid.map((x) => ({ [n + '.x']: x })), grid.map((y) => ({ [n + '.y']: y })));
  }
  return axes;
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const [lo, hi] = params.win ?? [-6, 6];
  const show = new Set(params.show ?? []);
  const locked = new Set(params.lock ?? []);
  let vars = base(params, scope);
  const v = createView(el, { xr: [lo, hi], yr: [lo, hi], aspect: 1, onResize: () => draw() });
  const arrow = (x0, y0, x1, y1, color, w = 3, dash = false) => {
    const c = v.ctx;
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = w;
    c.setLineDash(dash ? [6, 5] : []);
    c.beginPath();
    c.moveTo(v.X(x0), v.Y(y0));
    c.lineTo(v.X(x1), v.Y(y1));
    c.stroke();
    c.setLineDash([]);
    const ang = Math.atan2(v.Y(y1) - v.Y(y0), v.X(x1) - v.X(x0));
    c.beginPath();
    c.moveTo(v.X(x1), v.Y(y1));
    c.lineTo(v.X(x1) - 11 * Math.cos(ang - 0.4), v.Y(y1) - 11 * Math.sin(ang - 0.4));
    c.lineTo(v.X(x1) - 11 * Math.cos(ang + 0.4), v.Y(y1) - 11 * Math.sin(ang + 0.4));
    c.closePath();
    c.fill();
  };
  const draw = () => {
    drawGrid(v, th);
    const ax = vars['a.x'], ay = vars['a.y'], bx = vars['b.x'], by = vars['b.y'];
    if (show.has('sum')) arrow(0, 0, ax + bx, ay + by, th.ok, 3);
    if (show.has('sum')) {
      arrow(ax, ay, ax + bx, ay + by, th.muted, 1.5, true);
      arrow(bx, by, ax + bx, ay + by, th.muted, 1.5, true);
    }
    if (show.has('diff')) arrow(bx, by, ax, ay, th.ok, 3);
    if (show.has('proj')) {
      const bb = bx * bx + by * by;
      const t = bb ? (ax * bx + ay * by) / bb : 0;
      arrow(0, 0, t * bx, t * by, th.ok, 4);
      arrow(ax, ay, t * bx, t * by, th.muted, 1.5, true);
    }
    arrow(0, 0, ax, ay, th.accent, 3.5);
    arrow(0, 0, bx, by, th.bad, 3.5);
    v.ctx.font = '600 13px system-ui, sans-serif';
    v.ctx.fillStyle = th.accent;
    v.ctx.fillText('a', v.X(ax) + 6, v.Y(ay) - 6);
    v.ctx.fillStyle = th.bad;
    v.ctx.fillText('b', v.X(bx) + 6, v.Y(by) - 6);
    const o = compute(params, scope, vars);
    const lines = [];
    lines.push(`a = (${fmtNum(ax)}; ${fmtNum(ay)}), b = (${fmtNum(bx)}; ${fmtNum(by)})`);
    if (show.has('dot')) lines.push(`a·b = ${fmtNum(o.dot)}`);
    if (show.has('angle')) lines.push(`угол = ${fmtNum(Number(o.angle.toFixed(1)))}°`);
    if (show.has('det')) lines.push(`det = ${fmtNum(o.det)}`);
    if (show.has('sum')) lines.push(`a+b = (${fmtNum(ax + bx)}; ${fmtNum(ay + by)})`);
    if (show.has('diff')) lines.push(`a−b = (${fmtNum(ax - bx)}; ${fmtNum(ay - by)})`);
    v.ctx.fillStyle = th.fg;
    v.ctx.font = '12px system-ui, sans-serif';
    lines.forEach((t, i) => v.ctx.fillText(t, 8, 16 + 15 * i));
  };
  v.canvas.style.touchAction = 'none';
  let which = null;
  v.canvas.addEventListener('pointerdown', (e) => {
    const [px, py] = v.pos(e);
    const d = (n) => Math.hypot(px - v.X(vars[n + '.x']), py - v.Y(vars[n + '.y']));
    const cand = ['a', 'b'].filter((n) => !locked.has(n)).sort((p, q) => d(p) - d(q))[0];
    if (cand && d(cand) < 40) {
      which = cand;
      v.canvas.setPointerCapture(e.pointerId);
    }
  });
  v.canvas.addEventListener('pointermove', (e) => {
    if (!which) return;
    const [px, py] = v.pos(e);
    const x = Math.min(hi, Math.max(lo, Math.round(v.ix(px))));
    const y = Math.min(hi, Math.max(lo, Math.round(v.iy(py))));
    if (x === vars[which + '.x'] && y === vars[which + '.y']) return;
    vars = { ...vars, [which + '.x']: x, [which + '.y']: y };
    draw();
    ctx.onChange?.({ [which + '.x']: x, [which + '.y']: y });
  });
  const end = () => (which = null);
  v.canvas.addEventListener('pointerup', end);
  v.canvas.addEventListener('pointercancel', end);
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
