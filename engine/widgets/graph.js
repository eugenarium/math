// @ts-check
// Граф переходов цепи Маркова и блуждание по нему: стрелки с вероятностями, кнопки «шаг», частоты посещений.
import { createView, theme, label } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';

export const meta = {
  name: 'graph',
  params: {
    walk: ['flag', 1, 'блуждание по графу переходов'],
    P: ['E[][]', [[0.9, 0.1], [0.3, 0.7]], 'матрица переходов, строки дают 1'],
    start: ['N', 0, 'номер начального состояния (с нуля)'],
  },
  out: ['steps', 'f0', 'state', 'runs'],
};

export function controls() {
  return [{ name: 'run', type: 'actions', actions: [{ label: '+1', k: 1 }, { label: '+10', k: 10 }, { label: '+1000', k: 1000 }] }];
}

export function initial(params) {
  return { steps: 0, f0: 0, state: params.start ?? 0 };
}

export function compute(params, scope, vars) {
  return { steps: vars.steps ?? 0, runs: vars.steps ?? 0, f0: Number((vars.f0 ?? 0).toFixed(6)), state: vars.state ?? 0 };
}

/** Один шаг цепи из состояния s по матрице P с равномерным u. */
export function stepOf(P, s, u) {
  let acc = 0;
  for (let j = 0; j < P[s].length; j++) {
    acc += P[s][j];
    if (u <= acc) return j;
  }
  return P[s].length - 1;
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const P = params.P ?? [[0.9, 0.1], [0.3, 0.7]];
  const n = P.length;
  let vars = initial(params);
  const visits = new Array(n).fill(0);
  const v = createView(el, { xr: [0, 1], yr: [0, 1], aspect: 0.7, onResize: () => draw() });
  const pos = (i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n + (n === 2 ? Math.PI / 2 : 0);
    return [v.w / 2 + Math.cos(ang) * v.w * 0.32, v.h * 0.45 + Math.sin(ang) * v.h * 0.28];
  };
  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    const R = 24;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (!(P[i][j] > 0)) continue;
        const [x0, y0] = pos(i);
        const [x1, y1] = pos(j);
        c.strokeStyle = th.muted;
        c.fillStyle = th.muted;
        c.lineWidth = 1.5 + 3 * P[i][j];
        if (i === j) {
          c.beginPath();
          c.arc(x0, y0 - R - 8, 14, 0, 2 * Math.PI);
          c.stroke();
          c.fillText(fmtNum(P[i][j]), x0 - 8, y0 - R - 28);
        } else {
          // смещение стрелки в сторону, чтобы i→j и j→i не сливались
          const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
          const ox = (-dy / L) * 8, oy = (dx / L) * 8;
          c.beginPath();
          c.moveTo(x0 + (dx / L) * R + ox, y0 + (dy / L) * R + oy);
          c.lineTo(x1 - (dx / L) * (R + 6) + ox, y1 - (dy / L) * (R + 6) + oy);
          c.stroke();
          c.font = '12px system-ui, sans-serif';
          c.fillText(fmtNum(P[i][j]), (x0 + x1) / 2 + ox * 2.4 - 8, (y0 + y1) / 2 + oy * 2.4);
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = pos(i);
      c.beginPath();
      c.arc(x, y, R, 0, 2 * Math.PI);
      c.fillStyle = i === vars.state ? th.accent : th.line;
      c.fill();
      c.fillStyle = i === vars.state ? '#fff' : th.fg;
      c.font = '600 15px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(String(i + 1), x, y + 5);
    }
    c.textAlign = 'left';
    const tot = visits.reduce((a, b) => a + b, 0);
    label(v, tot ? `шагов ${vars.steps}; доли посещений: ${visits.map((x, i) => `${i + 1}: ${fmtNum(Number((x / tot).toFixed(3)))}`).join(', ')}` : 'нажми «+1», «+10»…', 8, h - 8, th.fg);
  };
  draw();
  return {
    update(next) {
      vars = { ...vars, ...next };
      draw();
    },
    act(name, a) {
      if (name !== 'run') return;
      let s = vars.state;
      for (let i = 0; i < a.k; i++) {
        s = stepOf(P, s, Math.random());
        visits[s]++;
      }
      const tot = visits.reduce((x, y) => x + y, 0);
      vars = { ...vars, state: s, steps: (vars.steps ?? 0) + a.k, f0: visits[0] / tot };
      draw();
      ctx.onChange?.({ state: s, steps: vars.steps, runs: vars.steps, f0: vars.f0 });
    },
    destroy() {
      v.destroy();
    },
  };
}
