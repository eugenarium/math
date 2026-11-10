// @ts-check
// Числовая прямая: промежутки, точки, окрестность, множество решений неравенства, перетаскиваемый промежуток.
import { createView, theme, niceStep } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalExpr } from '../core/mathx.js';
import { evalParam } from './kit.js';

export const meta = {
  name: 'numline',
  params: {
    iv: ['str[]', null, 'промежутки: ["(-2, 3]", "[5, inf)"]; при drag первый из них — начальное положение'],
    pts: ['E[]', null, 'отмеченные точки'],
    eps: ['E[]', null, '[a, ε]: окрестность точки a радиуса ε'],
    ineq: ['str', null, 'неравенство от x, например «x^2 - 4 < 0»: закрасить множество решений'],
    drag: ['flag', null, '1 — концы промежутка двигаются, касание конца делает его закрытым или открытым'],
    win: ['range', [-6, 6], 'окно по оси'],
  },
  out: ['a', 'b', 'ca', 'cb'],
};

const STEP = 0.5; // шаг привязки концов при перетаскивании

export function controls() {
  return [];
}

const INF = Infinity;
const num = (s, scope) => {
  const t = String(s).trim();
  if (/^\+?inf$/i.test(t)) return INF;
  if (/^-inf$/i.test(t)) return -INF;
  return Number(evalExpr(t, scope));
};

/** «(-2, 3]» → {lo, hi, loC, hiC}; концы inf/-inf бесконечны и всегда открыты. */
export function parseInterval(src, scope = {}) {
  const m = /^\s*([([])\s*([^,]+?)\s*,\s*([^)\]]+?)\s*([)\]])\s*$/.exec(String(src));
  if (!m) throw new Error('numline: промежуток «' + src + '» записан неверно, ожидалось вида (a, b]');
  const lo = num(m[2], scope);
  const hi = num(m[3], scope);
  return { lo, hi, loC: m[1] === '[' && Number.isFinite(lo), hiC: m[4] === ']' && Number.isFinite(hi) };
}

/**
 * Множество решений неравенства от x в окне [lo, hi]: список промежутков с границами, найденными делением пополам.
 * Закрытые концы — если в записи есть <= или >=. Концы, совпадающие с краем окна, считаются бесконечными.
 * @returns {{lo: number, hi: number, loC: boolean, hiC: boolean}[]}
 */
export function solveIneq(expr, scope, lo, hi) {
  const closed = /<=|>=|≤|≥/.test(expr);
  const test = (x) => {
    try {
      return evalExpr(expr, { ...scope, x }) === true;
    } catch {
      return false;
    }
  };
  const N = 2400;
  const margin = (hi - lo) * 0.5;
  const a0 = lo - margin;
  const b0 = hi + margin;
  const xs = Array.from({ length: N + 1 }, (_, i) => a0 + ((b0 - a0) * i) / N);
  const ok = xs.map(test);
  const edge = (x1, x2) => {
    // граница между точкой, где неравенство ложно, и точкой, где истинно
    let t = test(x1) ? x1 : x2;
    let f = test(x1) ? x2 : x1;
    for (let k = 0; k < 40; k++) {
      const m = (t + f) / 2;
      if (test(m)) t = m;
      else f = m;
    }
    return (t + f) / 2;
  };
  /** @type {{lo: number, hi: number, loC: boolean, hiC: boolean}[]} */
  const out = [];
  let start = null;
  for (let i = 0; i <= N; i++) {
    if (ok[i] && start === null) start = i === 0 ? -INF : edge(xs[i - 1], xs[i]);
    if ((!ok[i] || i === N) && start !== null) {
      const end = ok[i] ? INF : edge(xs[i - 1], xs[i]);
      out.push({ lo: start, hi: end, loC: closed && Number.isFinite(start), hiC: closed && Number.isFinite(end) });
      start = null;
    }
  }
  return out.map((r) => ({ ...r, lo: Number.isFinite(r.lo) ? Number(r.lo.toFixed(6)) : r.lo, hi: Number.isFinite(r.hi) ? Number(r.hi.toFixed(6)) : r.hi }));
}

const win = (params) => params.win ?? [-6, 6];

export function initial(params, scope = {}) {
  if (!params.drag) return {};
  const first = params.iv?.[0] ? parseInterval(params.iv[0], scope) : { lo: -1, hi: 1, loC: true, hiC: true };
  return { a: first.lo, b: first.hi, ca: first.loC ? 1 : 0, cb: first.hiC ? 1 : 0 };
}

export function compute(params, scope, vars) {
  return params.drag ? { a: vars.a, b: vars.b, ca: vars.ca, cb: vars.cb } : {};
}

/** Оси перебора для проверки достижимости цели: границы по сетке и открытость концов. */
export function dragAxes(params) {
  if (!params.drag) return [];
  const [lo, hi] = win(params);
  const grid = [];
  for (let x = lo; x <= hi + 1e-9; x += STEP) grid.push(Number(x.toFixed(6)));
  return [grid.map((a) => ({ a })), grid.map((b) => ({ b })), [{ ca: 0 }, { ca: 1 }], [{ cb: 0 }, { cb: 1 }]];
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const [wlo, whi] = win(params);
  const xr = [wlo, whi];
  let vars = initial(params, scope);
  let v;
  const axisY = () => v.h * 0.62;

  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    const y = axisY();
    // ось, деления, подписи
    c.strokeStyle = th.muted;
    c.fillStyle = th.muted;
    c.lineWidth = 1.5;
    c.font = '12px system-ui, sans-serif';
    c.textAlign = 'center';
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
    const st = niceStep(whi - wlo, 8);
    for (let x = Math.ceil(wlo / st) * st; x <= whi + 1e-9; x += st) {
      c.beginPath();
      c.moveTo(v.X(x), y - 5);
      c.lineTo(v.X(x), y + 5);
      c.stroke();
      // крайние подписи сдвигаем внутрь, чтобы знак «−» не обрезался краем холста
      c.fillText(fmtNum(Number(x.toPrecision(6))), Math.min(w - 14, Math.max(14, v.X(x))), y + 20);
    }

    const seg = (lo, hi, loC, hiC, color, lift = 0) => {
      const yy = y - lift;
      const x1 = Number.isFinite(lo) ? v.X(lo) : -4;
      const x2 = Number.isFinite(hi) ? v.X(hi) : w + 4;
      c.strokeStyle = color;
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x1, yy);
      c.lineTo(x2, yy);
      c.stroke();
      c.lineCap = 'butt';
      const end = (x, closed, finite) => {
        if (!finite) return; // бесконечность: линия уходит за край
        c.beginPath();
        c.arc(x, yy, 7, 0, Math.PI * 2);
        // открытый конец — «пустой» кружок цвета фона
        c.fillStyle = closed ? color : getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = color;
        c.stroke();
      };
      end(x1, loC, Number.isFinite(lo));
      end(x2, hiC, Number.isFinite(hi));
    };

    // решения неравенства
    if (params.ineq) for (const r of solveIneq(params.ineq, scope, wlo, whi)) seg(r.lo, r.hi, r.loC, r.hiC, th.accent, 0);
    // промежутки из iv (при drag первый — это подвижный)
    (params.iv ?? []).forEach((s, i) => {
      if (params.drag && i === 0) return;
      const r = parseInterval(s, scope);
      seg(r.lo, r.hi, r.loC, r.hiC, th.accent, 0);
    });
    // окрестность
    if (params.eps) {
      const [a, e] = evalParam(params.eps, scope);
      seg(a - e, a + e, false, false, th.ok, 0);
      c.fillStyle = th.fg;
      c.beginPath();
      c.arc(v.X(a), y, 4, 0, Math.PI * 2);
      c.fill();
      c.font = '600 13px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(`a = ${fmtNum(Number(a.toPrecision(4)))}, ε = ${fmtNum(Number(e.toPrecision(4)))}`, v.X(a), y - 20);
    }
    // точки
    for (const p of params.pts ?? []) {
      const x = evalParam(p, scope);
      c.fillStyle = th.fg;
      c.beginPath();
      c.arc(v.X(x), y, 5, 0, Math.PI * 2);
      c.fill();
    }
    // подвижный промежуток
    if (params.drag) {
      seg(vars.a, vars.b, !!vars.ca, !!vars.cb, th.bad, 0);
      c.font = '13px system-ui, sans-serif';
      c.fillStyle = th.fg;
      c.textAlign = 'left';
      c.fillText(`${vars.ca ? '[' : '('}${fmtNum(vars.a)}; ${fmtNum(vars.b)}${vars.cb ? ']' : ')'}`, 10, 18);
    }
  };

  v = createView(el, { xr, yr: [0, 1], aspect: 0.3, onResize: draw });

  if (params.drag) {
    v.canvas.style.touchAction = 'none';
    let which = null;
    let moved = false;
    let startX = 0;
    v.canvas.addEventListener('pointerdown', (e) => {
      const [px] = v.pos(e);
      const da = Math.abs(px - v.X(vars.a));
      const db = Math.abs(px - v.X(vars.b));
      if (Math.min(da, db) > 34) return;
      which = da <= db ? 'a' : 'b';
      moved = false;
      startX = px;
      v.canvas.setPointerCapture(e.pointerId);
    });
    v.canvas.addEventListener('pointermove', (e) => {
      if (!which) return;
      const [px] = v.pos(e);
      if (Math.abs(px - startX) > 6) moved = true;
      if (!moved) return;
      let x = Math.round(v.ix(px) / STEP) * STEP;
      x = Math.min(whi, Math.max(wlo, x));
      if (which === 'a') x = Math.min(x, vars.b);
      else x = Math.max(x, vars.a);
      vars = { ...vars, [which]: x };
      draw();
      ctx.onChange?.({ [which]: x });
    });
    const end = () => {
      if (which && !moved) {
        // касание без движения: открыть или закрыть конец
        const key = which === 'a' ? 'ca' : 'cb';
        vars = { ...vars, [key]: vars[key] ? 0 : 1 };
        draw();
        ctx.onChange?.({ [key]: vars[key] });
      }
      which = null;
    };
    v.canvas.addEventListener('pointerup', end);
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
