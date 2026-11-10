// @ts-check
// Суммы Римана: левые, правые, средние точки, трапеции, Симпсон.
import { createView, theme, drawGrid, plotFn, label, autoRange, ASPECT } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { evalParam, makeFn, scopeVars } from './kit.js';

export const meta = {
  name: 'riemann',
  params: {
    f: ['E', null, 'функция'],
    a: ['E', null, 'левый конец'],
    b: ['E', null, 'правый конец'],
    n: ['range', [1, 200, 4], 'число отрезков: [min, max, начало]'],
    rule: ['enum', 'l', 'правило: l, r, m, t, s или список для переключателя'],
  },
  out: ['n', 'S', 'err'],
};

const RULES = { l: 'левые', r: 'правые', m: 'средние', t: 'трапеции', s: 'Симпсон' };

function rules(params) {
  const r = Array.isArray(params.rule) ? params.rule : [params.rule ?? 'l'];
  return r.map(String);
}

export function controls(params) {
  const [min, max, start = min] = params.n ?? [1, 200, 4];
  const list = rules(params);
  const c = [{ name: 'n', type: 'slider', min, max, start, step: 1 }];
  if (list.length > 1) c.push({ name: 'rule', type: 'choice', options: list, labels: list.map((x) => RULES[x] ?? x) });
  return c;
}

export function initial(params) {
  const [min, , start = min] = params.n ?? [1, 200, 4];
  return { n: start, rule: rules(params)[0] };
}

/** Сумма по правилу; для Симпсона число отрезков чётное (нечётное увеличивается на 1). */
export function sumRule(f, a, b, n, rule) {
  const h = (b - a) / n;
  let s = 0;
  if (rule === 'l') for (let i = 0; i < n; i++) s += f(a + i * h);
  else if (rule === 'r') for (let i = 1; i <= n; i++) s += f(a + i * h);
  else if (rule === 'm') for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h);
  else if (rule === 't') {
    s = (f(a) + f(b)) / 2;
    for (let i = 1; i < n; i++) s += f(a + i * h);
  } else if (rule === 's') {
    const m = n % 2 ? n + 1 : n;
    const k = (b - a) / m;
    s = f(a) + f(b);
    for (let i = 1; i < m; i++) s += f(a + i * k) * (i % 2 ? 4 : 2);
    return (s * k) / 3;
  }
  return s * h;
}

export function exactIntegral(f, a, b) {
  return sumRule(f, a, b, 4000, 's');
}

export function compute(params, scope, vars) {
  const sc = { ...scope, ...scopeVars(vars) };
  const a = evalParam(params.a, sc);
  const b = evalParam(params.b, sc);
  const f = makeFn(params.f, sc);
  const S = sumRule(f, a, b, vars.n, vars.rule);
  return { n: vars.n, S, err: Math.abs(S - exactIntegral(f, a, b)) };
}

export function mount(el, { params, scope }) {
  const th = theme();
  const a = evalParam(params.a, scope);
  const b = evalParam(params.b, scope);
  const f = makeFn(params.f, scope);
  const pad = (b - a) * 0.12;
  const xr = [a - pad, b + pad];
  const yr = autoRange(f, a, b, [0]);
  let vars = initial(params);
  let v;
  const draw = () => {
    drawGrid(v, th);
    const { ctx } = v;
    const n = vars.n;
    const h = (b - a) / n;
    ctx.fillStyle = th.accent + '40';
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 1;
    const rule = vars.rule;
    if (rule === 'l' || rule === 'r' || rule === 'm') {
      for (let i = 0; i < n; i++) {
        const x0 = a + i * h;
        const c = rule === 'l' ? x0 : rule === 'r' ? x0 + h : x0 + h / 2;
        const y = f(c);
        if (!Number.isFinite(y)) continue;
        const px = v.X(x0);
        const py = v.Y(Math.max(y, 0));
        ctx.beginPath();
        ctx.rect(px, py, v.X(x0 + h) - px, Math.abs(v.Y(y) - v.Y(0)));
        ctx.fill();
        ctx.stroke();
      }
    } else if (rule === 't') {
      for (let i = 0; i < n; i++) {
        const x0 = a + i * h;
        ctx.beginPath();
        ctx.moveTo(v.X(x0), v.Y(0));
        ctx.lineTo(v.X(x0), v.Y(f(x0)));
        ctx.lineTo(v.X(x0 + h), v.Y(f(x0 + h)));
        ctx.lineTo(v.X(x0 + h), v.Y(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // Симпсон: параболы по трём точкам каждой пары отрезков
      const m = n % 2 ? n + 1 : n;
      const k = (b - a) / m;
      for (let i = 0; i < m; i += 2) {
        const x0 = a + i * k;
        const y0 = f(x0);
        const y1 = f(x0 + k);
        const y2 = f(x0 + 2 * k);
        ctx.beginPath();
        ctx.moveTo(v.X(x0), v.Y(0));
        for (let j = 0; j <= 24; j++) {
          const t = (j / 24) * 2 - 1; // −1…1 вокруг середины
          const y = y1 + ((y2 - y0) / 2) * t + ((y0 - 2 * y1 + y2) / 2) * t * t;
          ctx.lineTo(v.X(x0 + k + t * k), v.Y(y));
        }
        ctx.lineTo(v.X(x0 + 2 * k), v.Y(0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    plotFn(v, f, th.fg, 2.5);
    const o = compute(params, scope, vars);
    label(v, `S = ${fmtNum(Number(o.S.toPrecision(6)))}    ошибка ${fmtNum(Number(o.err.toPrecision(3)))}`, 10, 18, th.fg);
  };
  v = createView(el, { xr, yr, aspect: ASPECT[params.h] ?? ASPECT.m, onResize: draw });
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
