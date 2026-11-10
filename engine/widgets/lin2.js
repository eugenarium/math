// @ts-check
// Линейное преобразование плоскости: сетка под матрицей M, базис, определитель, собственные прямые, пробный вектор.
import { createView, theme, drawGrid, plotLine, dot, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalParam, sliderSpec, scopeVars, unionOverSliders } from './kit.js';

export const meta = {
  name: 'lin2',
  params: {
    M: ['E[][]', null, 'матрица 2×2: числа, выражения или имя матрицы'],
    shape: ['enum', 'grid', 'grid | square | F | circle'],
    anim: ['flag', null, 'зарезервировано'],
    show: ['str[]', null, 'basis, det, eig'],
    probe: ['E[]', null, 'пробный вектор [x, y]; перетаскивается за конец'],
    sl: ['sliders', null, 'слайдеры {имя: [min, max, начало, шаг]}'],
  },
  out: ['m11', 'm12', 'm21', 'm22', 'det', 'v.x', 'v.y', 'ang', 'lam'],
};

export function controls(params) {
  return Object.entries(params.sl ?? {}).map(([name, a]) => sliderSpec(name, a));
}

export function initial(params, scope = {}) {
  const vars = {};
  for (const c of controls(params)) vars[c.name] = c.start;
  if (params.probe) {
    const [x, y] = evalParam(params.probe, { ...scope, ...vars });
    vars['v.x'] = x;
    vars['v.y'] = y;
  }
  return vars;
}

/** Матрица 2×2 при текущих слайдерах. */
export function matrixOf(params, scope, vars) {
  const M = evalParam(params.M, { ...scope, ...scopeVars(vars) });
  if (!Array.isArray(M) || M.length !== 2 || M[0].length !== 2) throw new Error('lin2: M должна быть матрицей 2×2');
  return M;
}

const apply = (M, [x, y]) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];

/** Угол между прямыми v и Av (градусы, 0…90) и отношение λ = (Av·v)/(v·v). */
export function probeStats(M, v) {
  const w = apply(M, v);
  const vv = v[0] * v[0] + v[1] * v[1];
  const dotp = v[0] * w[0] + v[1] * w[1];
  const cross = v[0] * w[1] - v[1] * w[0];
  if (vv < 1e-12) return { ang: 0, lam: 0 };
  if (Math.hypot(w[0], w[1]) < 1e-9) return { ang: 0, lam: 0 };
  return { ang: (Math.atan2(Math.abs(cross), Math.abs(dotp)) * 180) / Math.PI, lam: dotp / vv };
}

export function compute(params, scope, vars) {
  const M = matrixOf(params, scope, vars);
  const out = {};
  for (const [k, v] of Object.entries(vars)) if (typeof v === 'number') out[k] = v;
  Object.assign(out, { m11: M[0][0], m12: M[0][1], m21: M[1][0], m22: M[1][1], det: M[0][0] * M[1][1] - M[0][1] * M[1][0] });
  if (params.probe) Object.assign(out, probeStats(M, [vars['v.x'], vars['v.y']]));
  return out;
}

/** Ось перебора для цели: направления пробного вектора каждые 0.25°. */
export function dragAxes(params) {
  if (!params.probe) return [];
  const steps = 720;
  return [Array.from({ length: steps }, (_, i) => ({ 'v.x': Math.cos((Math.PI * i) / steps), 'v.y': Math.sin((Math.PI * i) / steps) }))];
}

/** Собственные направления вещественной матрицы 2×2: [{lam, v}] */
export function eigenLines(M) {
  const [[a, b], [c, d]] = M;
  const tr = a + d;
  const det = a * d - b * c;
  const disc = (tr * tr) / 4 - det;
  if (disc < -1e-12) return [];
  const r = Math.sqrt(Math.max(disc, 0));
  const lams = r < 1e-9 ? [tr / 2] : [tr / 2 + r, tr / 2 - r];
  return lams.map((lam) => {
    let v;
    if (Math.abs(b) > 1e-9) v = [b, lam - a];
    else if (Math.abs(c) > 1e-9) v = [lam - d, c];
    else v = Math.abs(lam - a) < 1e-9 ? [1, 0] : [0, 1];
    const n = Math.hypot(v[0], v[1]);
    return { lam, v: [v[0] / n, v[1] / n] };
  });
}

const F_SHAPE = [[0, 0], [0, 2], [1.2, 2], [1.2, 1.7], [0.4, 1.7], [0.4, 1.2], [0.9, 1.2], [0.9, 0.9], [0.4, 0.9], [0.4, 0], [0, 0]];

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  let vars = initial(params, scope);
  // окно фиксируем по самым «широким» значениям слайдеров, чтобы оно не прыгало
  const ext = unionOverSliders({ controls, initial }, params, scope, (v) => {
    const M = matrixOf(params, scope, v);
    const pts = [[1, 0], [0, 1], [1, 1]].map((p) => apply(M, p));
    if (params.probe) pts.push([v['v.x'], v['v.y']], apply(M, [v['v.x'], v['v.y']]));
    return Math.max(...pts.flat().map(Math.abs));
  });
  const r = Math.max(3, Math.ceil(Math.max(...ext, 1) * 1.35));
  const xr = [-r, r];
  const yr = [-r, r];
  const shape = params.shape ?? 'grid';
  let v;

  const poly = (pts, M, fill, stroke) => {
    const c = v.ctx;
    c.beginPath();
    pts.forEach((p, i) => {
      const q = apply(M, p);
      if (i) c.lineTo(v.X(q[0]), v.Y(q[1]));
      else c.moveTo(v.X(q[0]), v.Y(q[1]));
    });
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 2;
      c.stroke();
    }
  };
  const arrow = (to, color) => {
    const c = v.ctx;
    const x = v.X(to[0]);
    const y = v.Y(to[1]);
    const x0 = v.X(0);
    const y0 = v.Y(0);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x, y);
    c.stroke();
    const a = Math.atan2(y - y0, x - x0);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 11 * Math.cos(a - 0.4), y - 11 * Math.sin(a - 0.4));
    c.lineTo(x - 11 * Math.cos(a + 0.4), y - 11 * Math.sin(a + 0.4));
    c.closePath();
    c.fill();
  };

  const draw = () => {
    let M;
    try {
      M = matrixOf(params, scope, vars);
    } catch {
      return;
    }
    drawGrid(v, th);
    const c = v.ctx;
    const show = params.show ?? [];
    const N = r + 2;

    if (shape === 'grid') {
      c.strokeStyle = th.accent + '66';
      c.lineWidth = 1.2;
      c.beginPath();
      for (let k = -N; k <= N; k++) {
        const a = apply(M, [k, -N]);
        const b = apply(M, [k, N]);
        c.moveTo(v.X(a[0]), v.Y(a[1]));
        c.lineTo(v.X(b[0]), v.Y(b[1]));
        const a2 = apply(M, [-N, k]);
        const b2 = apply(M, [N, k]);
        c.moveTo(v.X(a2[0]), v.Y(a2[1]));
        c.lineTo(v.X(b2[0]), v.Y(b2[1]));
      }
      c.stroke();
    }
    if (shape === 'square' || show.includes('det')) poly([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], M, th.accent + '33', th.accent);
    if (shape === 'F') poly(F_SHAPE, M, th.accent + '55', th.accent);
    if (shape === 'circle') {
      const pts = Array.from({ length: 73 }, (_, i) => [Math.cos((i / 72) * 2 * Math.PI), Math.sin((i / 72) * 2 * Math.PI)]);
      poly(pts, M, th.accent + '33', th.accent);
    }
    if (show.includes('eig')) for (const e of eigenLines(M)) plotLine(v, 0, 0, e.v[1] / (e.v[0] || 1e-12), th.ok, 2, [6, 4]);
    if (show.includes('basis') || shape === 'F' || shape === 'square') {
      arrow(apply(M, [1, 0]), th.accent);
      arrow(apply(M, [0, 1]), th.ok);
    }

    if (params.probe) {
      const p = [vars['v.x'], vars['v.y']];
      const w = apply(M, p);
      const st = probeStats(M, p);
      const on = st.ang < 2;
      if (Math.hypot(p[0], p[1]) > 1e-9) plotLine(v, 0, 0, p[1] / (p[0] || 1e-12), th.muted, 1.5, [4, 4]);
      arrow(w, on ? th.ok : th.bad);
      arrow(p, on ? th.ok : th.fg);
      dot(v, p[0], p[1], on ? th.ok : th.fg, 9);
      label(v, `угол ${fmtNum(Number(st.ang.toFixed(1)))}°   множитель ${fmtNum(Number(st.lam.toFixed(2)))}${on ? '  ✓' : ''}`, 10, 18, th.fg);
    }
    if (show.includes('det')) label(v, `det = ${fmtNum(Number((M[0][0] * M[1][1] - M[0][1] * M[1][0]).toFixed(3)))}`, 10, v.h - 10, th.fg);
  };

  v = createView(el, { xr, yr, aspect: 1, onResize: draw }); // квадрат: иначе углы и направления искажаются

  if (params.probe) {
    v.canvas.style.touchAction = 'none';
    let dragging = false;
    const move = (e) => {
      const [px, py] = v.pos(e);
      let x = v.ix(px);
      let y = v.iy(py);
      if (Math.hypot(x, y) < 0.15) {
        x = 0.15;
        y = 0;
      }
      vars = { ...vars, 'v.x': x, 'v.y': y };
      draw();
      ctx.onChange?.({ 'v.x': x, 'v.y': y });
    };
    v.canvas.addEventListener('pointerdown', (e) => {
      const [px, py] = v.pos(e);
      if (Math.hypot(px - v.X(vars['v.x']), py - v.Y(vars['v.y'])) > 40) return;
      dragging = true;
      v.canvas.setPointerCapture(e.pointerId);
    });
    v.canvas.addEventListener('pointermove', (e) => dragging && move(e));
    v.canvas.addEventListener('pointerup', () => (dragging = false));
    v.canvas.addEventListener('pointercancel', () => (dragging = false));
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
