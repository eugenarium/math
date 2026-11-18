// @ts-check
// Дерево выбора: число вариантов на каждом шаге, выбор без возвращения, вероятностное дерево. Касание листа выделяет путь.
import { createView, theme, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';

export const meta = {
  name: 'ctree',
  params: {
    st: ['E[]', [3, 2], 'число вариантов на каждом шаге; не больше трёх шагов'],
    names: ['str[]', null, 'подписи шагов'],
    dep: ['flag', null, '1 — без возвращения: на каждом следующем шаге вариантов на один меньше'],
    pr: ['E[][]', null, 'вероятностное дерево на два шага: [[p1, p2, …], [условные вероятности каждой ветви подряд]]'],
  },
  out: ['leaves', 'P', 'sel'],
};

export function controls() {
  return [];
}

/** Числа вариантов по шагам с учётом «без возвращения». */
export function counts(params) {
  const st = params.pr ? [params.pr[0].length, params.pr[1].length / params.pr[0].length] : (params.st ?? [3, 2]).slice(0, 3);
  return st.map((n, i) => (params.dep && !params.pr ? Math.max(1, n - i) : n));
}

export function leaves(params) {
  return counts(params).reduce((a, b) => a * b, 1);
}

/** Вероятность листа с номером idx (в порядке обхода) для вероятностного дерева. */
export function leafProb(params, idx) {
  const [first, second] = params.pr;
  const m = second.length / first.length;
  const i = Math.floor(idx / m);
  const j = idx % m;
  return first[i] * second[i * m + j];
}

export function initial() {
  return { sel: -1 };
}

export function compute(params, scope, vars) {
  const L = leaves(params);
  return { leaves: L, P: params.pr && vars.sel >= 0 ? Number(leafProb(params, vars.sel).toFixed(6)) : 0, sel: vars.sel ?? -1 };
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const cs = counts(params);
  const L = leaves(params);
  let vars = initial();
  const v = createView(el, { xr: [0, 1], yr: [0, 1], aspect: 0.75, onResize: () => draw() });
  // положение листьев
  const leafPos = (k) => [v.w - 40, 30 + ((v.h - 60) * (k + 0.5)) / Math.min(L, 40)];
  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    if (L > 40) {
      label(v, `Всего ${L} исходов: ${cs.join(' · ')} = ${L}. Дерево слишком велико, чтобы его показать.`, 8, 20, th.fg);
      return;
    }
    const levels = cs.length;
    const X = (lvl) => 30 + ((w - 80) * lvl) / levels;
    // позиция узла на уровне lvl с индексом idx среди узлов этого уровня
    const nodeY = (lvl, idx) => {
      const per = cs.slice(lvl).reduce((a, b) => a * b, 1); // листьев под узлом
      return 30 + ((h - 60) * (idx * per + per / 2)) / L;
    };
    const total = (lvl) => cs.slice(0, lvl).reduce((a, b) => a * b, 1);
    c.lineWidth = 1.5;
    c.font = '11px system-ui, sans-serif';
    for (let lvl = 0; lvl < levels; lvl++) {
      for (let idx = 0; idx < total(lvl); idx++) {
        const y0 = nodeY(lvl, idx);
        for (let b = 0; b < cs[lvl]; b++) {
          const child = idx * cs[lvl] + b;
          const y1 = nodeY(lvl + 1, child);
          const onPath = vars.sel >= 0 && Math.floor(vars.sel / cs.slice(lvl + 1).reduce((a, q) => a * q, 1)) === child;
          c.strokeStyle = onPath ? th.accent : th.line;
          c.lineWidth = onPath ? 3 : 1.5;
          c.beginPath();
          c.moveTo(X(lvl), y0);
          c.lineTo(X(lvl + 1), y1);
          c.stroke();
          if (params.pr && lvl < 2) {
            const [first, second] = params.pr;
            const p = lvl === 0 ? first[b] : second[idx * cs[1] + b];
            c.fillStyle = th.muted;
            c.textAlign = 'center';
            c.fillText(fmtNum(p), (X(lvl) + X(lvl + 1)) / 2, (y0 + y1) / 2 - 3);
          }
        }
      }
    }
    for (let k = 0; k < L; k++) {
      const [, y] = [0, nodeY(levels, k)];
      c.fillStyle = k === vars.sel ? th.accent : th.muted;
      c.beginPath();
      c.arc(X(levels), y, k === vars.sel ? 6 : 4, 0, 2 * Math.PI);
      c.fill();
    }
    c.fillStyle = th.fg;
    c.beginPath();
    c.arc(X(0), nodeY(0, 0), 5, 0, 2 * Math.PI);
    c.fill();
    const names = params.names ?? [];
    c.textAlign = 'center';
    c.fillStyle = th.muted;
    names.slice(0, levels).forEach((n, i) => c.fillText(n, (X(i) + X(i + 1)) / 2, h - 8));
    let txt = `исходов: ${cs.join(' · ')} = ${L}`;
    if (vars.sel >= 0) txt += params.pr ? `; путь: вероятность ${fmtNum(Number(leafProb(params, vars.sel).toFixed(4)))}` : `; выбран исход №${vars.sel + 1}`;
    label(v, txt, 8, 16, th.fg);
  };
  v.canvas.addEventListener('pointerdown', (e) => {
    if (L > 40) return;
    const [, py] = v.pos(e);
    const k = Math.round(((py - 30) * L) / (v.h - 60) - 0.5);
    vars = { sel: Math.min(L - 1, Math.max(0, k)) };
    draw();
    ctx.onChange?.(vars);
  });
  draw();
  void leafPos;
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
