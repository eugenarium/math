// @ts-check
// Треугольник Паскаля: касание числа показывает $C_n^k$ и двух «родителей», суммы строк, чётность.
import { createView, theme, label } from '../core/plot.js';

export const meta = {
  name: 'pascal',
  params: {
    n: ['N', 8, 'число строк'],
    show: ['str[]', null, 'mod2 — закрасить нечётные числа'],
  },
  out: ['n', 'k', 'val'],
};

export function controls() {
  return [];
}

export const binom = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

export function initial(params) {
  const n = Math.min(10, params.n ?? 8) - 1;
  return { n, k: Math.floor(n / 2), val: binom(n, Math.floor(n / 2)) };
}

export function compute(params, scope, vars) {
  return { n: vars.n, k: vars.k, val: binom(vars.n, vars.k) };
}

export function dragAxes(params) {
  const rows = Math.min(10, params.n ?? 8);
  const axes = [];
  const options = [];
  for (let n = 0; n < rows; n++) for (let k = 0; k <= n; k++) options.push({ n, k, val: binom(n, k) });
  axes.push(options);
  return axes;
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const rows = Math.min(10, params.n ?? 8);
  const odd = (params.show ?? []).includes('mod2');
  let vars = initial(params);
  const v = createView(el, { xr: [0, 1], yr: [0, 1], aspect: 0.7, onResize: () => draw() });
  const cellW = () => Math.min(40, (v.w - 10) / rows);
  const pos = (n, k) => [v.w / 2 + (k - n / 2) * cellW(), 24 + n * ((v.h - 50) / rows)];
  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    c.font = '600 13px system-ui, sans-serif';
    c.textAlign = 'center';
    for (let n = 0; n < rows; n++) {
      for (let k = 0; k <= n; k++) {
        const [x, y] = pos(n, k);
        const sel = n === vars.n && k === vars.k;
        const parent = vars.n > 0 && n === vars.n - 1 && (k === vars.k || k === vars.k - 1);
        c.fillStyle = sel ? th.accent : parent ? th.ok + '66' : odd && binom(n, k) % 2 ? th.bad + '55' : 'transparent';
        c.beginPath();
        c.arc(x, y - 4, 14, 0, 2 * Math.PI);
        c.fill();
        c.fillStyle = sel ? '#fff' : th.fg;
        c.fillText(String(binom(n, k)), x, y);
      }
    }
    const val = binom(vars.n, vars.k);
    label(v, `C(${vars.n}, ${vars.k}) = ${val}; сумма строки ${2 ** vars.n}`, 8, h - 8, th.fg);
  };
  v.canvas.addEventListener('pointerdown', (e) => {
    const [px, py] = v.pos(e);
    let best = null;
    let bd = 24;
    for (let n = 0; n < rows; n++)
      for (let k = 0; k <= n; k++) {
        const [x, y] = pos(n, k);
        const d = Math.hypot(px - x, py - (y - 4));
        if (d < bd) {
          bd = d;
          best = { n, k, val: binom(n, k) };
        }
      }
    if (best) {
      vars = best;
      draw();
      ctx.onChange?.(best);
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
