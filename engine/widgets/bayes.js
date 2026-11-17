// @ts-check
// Формула Байеса на частотах: 1000 фигурок разбиты на четыре группы; слайдеры базовой частоты, чувствительности, специфичности.
import { createView, theme } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { sliderSpec } from './kit.js';

export const meta = {
  name: 'bayes',
  params: {
    sl: ['sliders', null, 'слайдеры {prior, sens, spec: [min, max, начало, шаг]}; имена остальных берутся из prior/sens/spec'],
    prior: ['N', 0.05, 'базовая частота (если нет слайдера)'],
    sens: ['N', 0.9, 'чувствительность P(+|болен)'],
    spec: ['N', 0.9, 'специфичность P(−|здоров)'],
  },
  out: ['prior', 'sens', 'spec', 'post', 'tp', 'fp'],
};

export function controls(params) {
  return Object.entries(params.sl ?? {}).map(([n, a]) => sliderSpec(n, a));
}

export function initial(params) {
  const v = { prior: params.prior ?? 0.05, sens: params.sens ?? 0.9, spec: params.spec ?? 0.9 };
  for (const c of controls(params)) v[c.name] = c.start;
  return v;
}

/** Вероятность болезни при положительном тесте и доли групп. */
export function compute(params, scope, vars) {
  const prior = vars.prior, sens = vars.sens, spec = vars.spec;
  const tp = prior * sens;
  const fp = (1 - prior) * (1 - spec);
  const post = tp + fp > 0 ? tp / (tp + fp) : 0;
  return { prior, sens, spec, post: Number(post.toFixed(6)), tp: Number(tp.toFixed(6)), fp: Number(fp.toFixed(6)) };
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  let vars = initial(params);
  const v = createView(el, { xr: [0, 1], yr: [0, 1], aspect: 0.75, onResize: () => draw() });
  const COLS = 40;
  const N = 1000;
  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    const o = compute(params, {}, vars);
    // группы: больные с плюсом, больные с минусом, здоровые с плюсом, здоровые с минусом
    const sick = Math.round(N * o.prior);
    const tp = Math.round(sick * o.sens);
    const fn = sick - tp;
    const healthy = N - sick;
    const fp = Math.round(healthy * (1 - o.spec));
    const tn = healthy - fp;
    const groups = [
      [tp, th.bad, 'больные, тест +'],
      [fn, th.muted, 'больные, тест −'],
      [fp, th.accent, 'здоровые, тест +'],
      [tn, th.line, 'здоровые, тест −'],
    ];
    const top = 42;
    const cell = Math.min((w - 8) / COLS, (h - top - 56) / Math.ceil(N / COLS));
    let i = 0;
    for (const [n, color] of groups) {
      c.fillStyle = color;
      for (let k = 0; k < n; k++, i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        c.beginPath();
        c.arc(4 + col * cell + cell / 2, top + row * cell + cell / 2, cell * 0.38, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.fillStyle = th.fg;
    c.font = '600 14px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText(`Положительных: ${tp + fp}, из них больных ${tp}`, 6, 18);
    c.font = '13px system-ui, sans-serif';
    c.fillText(`Шанс болезни при плюсе: ${tp + fp ? fmtNum(Number(((100 * tp) / (tp + fp)).toFixed(1))) : 0} %`, 6, 36);
    // легенда
    c.font = '11px system-ui, sans-serif';
    groups.forEach(([n, color, name], g) => {
      const x = 6 + (g % 2) * (w / 2);
      const y = h - 30 + Math.floor(g / 2) * 16;
      c.fillStyle = color;
      c.beginPath();
      c.arc(x + 5, y - 4, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = th.fg;
      c.fillText(`${name}: ${n}`, x + 14, y);
    });
  };
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
