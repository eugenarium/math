// @ts-check
// Линейное программирование на плоскости: допустимая область, вершины, линия уровня цели, выбор вершины касанием.
import { createView, drawGrid, theme, label, dot } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr } from '../core/mathx.js';

export const meta = {
  name: 'lp',
  params: {
    cons: ['str[]', null, 'ограничения: ["x+2*y<=8", "x>=0", "y>=0"]'],
    obj: ['str', null, 'цель: «max 3*x+2*y» или «min …»'],
    win: ['range', [0, 8], 'окно по обеим осям'],
  },
  out: ['x', 'y', 'val'],
};

export function controls() {
  return [];
}

/** Ограничение → {a, b, c} для a·x + b·y ≤ c. */
export function parseCons(src) {
  const m = /^(.*?)(<=|>=|<|>)(.*)$/.exec(String(src));
  if (!m) throw new Error('lp: нет знака неравенства в «' + src + '»');
  const g = (x, y) => Number(evalExpr(m[1], { x, y })) - Number(evalExpr(m[3], { x, y }));
  const c0 = g(0, 0);
  let a = g(1, 0) - c0, b = g(0, 1) - c0, c = -c0;
  if (m[2].startsWith('>')) {
    a = -a;
    b = -b;
    c = -c;
  }
  return { a, b, c };
}

/** Допустимый многоугольник: отсечение окна полуплоскостями. */
export function polygon(cons, [lo, hi]) {
  let poly = [[lo, lo], [hi, lo], [hi, hi], [lo, hi]];
  for (const { a, b, c } of cons) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const fp = a * p[0] + b * p[1] - c, fq = a * q[0] + b * q[1] - c;
      if (fp <= 1e-9) out.push(p);
      if ((fp < -1e-9 && fq > 1e-9) || (fp > 1e-9 && fq < -1e-9)) {
        const t = fp / (fp - fq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    poly = out;
    if (!poly.length) break;
  }
  return poly;
}

export function objective(src) {
  const m = /^\s*(max|min)\s+(.*)$/.exec(String(src));
  if (!m) throw new Error('lp: цель должна начинаться с max или min');
  return { sign: m[1] === 'max' ? 1 : -1, f: (x, y) => Number(evalExpr(m[2], { x, y })) };
}

/** Лучшая вершина многоугольника. */
export function best(poly, obj) {
  return poly.reduce((b, p) => (obj.sign * obj.f(p[0], p[1]) > obj.sign * obj.f(b[0], b[1]) ? p : b), poly[0]);
}

export function initial(params) {
  const win = params.win ?? [0, 8];
  const poly = polygon((params.cons ?? []).map(parseCons), win);
  return poly.length ? { x: Number(poly[0][0].toFixed(6)), y: Number(poly[0][1].toFixed(6)) } : { x: 0, y: 0 };
}

export function compute(params, scope, vars) {
  const obj = objective(params.obj);
  return { x: vars.x, y: vars.y, val: Number(obj.f(vars.x, vars.y).toFixed(6)) };
}

export function dragAxes(params) {
  const win = params.win ?? [0, 8];
  const poly = polygon((params.cons ?? []).map(parseCons), win);
  return [poly.map(([x, y]) => ({ x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) }))];
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const win = params.win ?? [0, 8];
  const cons = (params.cons ?? []).map(parseCons);
  const poly = polygon(cons, win);
  const obj = objective(params.obj);
  let vars = initial(params);
  const v = createView(el, { xr: win.slice(), yr: win.slice(), aspect: 0.85, onResize: () => draw() });
  const draw = () => {
    drawGrid(v, th);
    const { ctx: c } = v;
    if (poly.length) {
      c.beginPath();
      poly.forEach(([x, y], i) => (i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y))));
      c.closePath();
      c.fillStyle = th.accent + '33';
      c.fill();
      c.strokeStyle = th.accent;
      c.lineWidth = 2.5;
      c.stroke();
    }
    // линия уровня цели через выбранную вершину
    const val = obj.f(vars.x, vars.y);
    const g = (x, y) => obj.f(x, y) - val;
    const p0 = [obj.f(1, 0) - obj.f(0, 0), obj.f(0, 1) - obj.f(0, 0)];
    if (p0[0] || p0[1]) {
      c.strokeStyle = th.bad;
      c.lineWidth = 2;
      c.setLineDash([6, 4]);
      c.beginPath();
      const pts = [];
      for (const x of [win[0], win[1]]) if (p0[1]) pts.push([x, vars.y - (p0[0] * (x - vars.x)) / p0[1]]);
      if (p0[1]) {
        c.moveTo(v.X(pts[0][0]), v.Y(pts[0][1]));
        c.lineTo(v.X(pts[1][0]), v.Y(pts[1][1]));
      } else {
        c.moveTo(v.X(vars.x), v.Y(win[0]));
        c.lineTo(v.X(vars.x), v.Y(win[1]));
      }
      c.stroke();
      c.setLineDash([]);
    }
    void g;
    poly.forEach(([x, y]) => dot(v, x, y, th.muted, 5));
    dot(v, vars.x, vars.y, th.bad, 7);
    label(v, `(${fmtNum(Number(vars.x.toFixed(2)))}; ${fmtNum(Number(vars.y.toFixed(2)))}): цель = ${fmtNum(Number(val.toFixed(2)))}`, 8, 18, th.fg);
  };
  v.canvas.addEventListener('pointerdown', (e) => {
    const [px, py] = v.pos(e);
    let bestP = null;
    let bd = 40;
    for (const [x, y] of poly) {
      const d = Math.hypot(px - v.X(x), py - v.Y(y));
      if (d < bd) {
        bd = d;
        bestP = [x, y];
      }
    }
    if (bestP) {
      vars = { x: Number(bestP[0].toFixed(6)), y: Number(bestP[1].toFixed(6)) };
      draw();
      ctx.onChange?.(vars);
    }
  });
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
