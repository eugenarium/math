// @ts-check
// Диаграмма Венна на 2 или 3 множества: закраска по выражению, закраска пальцем, вероятности областей.
import { createView, theme } from '../core/plot.js';
import { fmtNum } from '../core/gen.js';
import { vmask } from '../core/setexpr.js';
import { evalParam } from './kit.js';

export const meta = {
  name: 'venn',
  params: {
    n: ['enum', 2, 'число множеств: 2 или 3'],
    expr: ['str', null, 'закрасить область, например «A & !B» (& и, | или, ! не, ^ ровно одно)'],
    tap: ['flag', null, '1 — ученик закрашивает области касанием'],
    pr: ['obj', null, 'вероятности: {A, B, AB} для двух множеств, {A, B, C, AB, AC, BC, ABC} для трёх'],
  },
  out: ['sel', 'P'],
};

const NAMES = ['A', 'B', 'C'];

export function controls() {
  return [];
}

const count = (params) => (params.n === 3 ? 3 : 2);

export function initial(params) {
  if (params.tap) return { sel: 0 };
  return { sel: params.expr ? vmask(params.expr, count(params)) : 0 };
}

/** Ось перебора для проверки достижимости цели: любая закраска областей (при tap). */
export function dragAxes(params) {
  if (!params.tap) return [];
  const regions = 1 << count(params);
  return [Array.from({ length: 1 << regions }, (_, m) => ({ sel: m }))];
}

/** Вероятности всех областей по пересечениям (формула включений-исключений). Область r: бит k — «в множестве k». */
export function regionProbs(pr, n, scope = {}) {
  const key = (m) => NAMES.slice(0, n).filter((_, k) => (m >> k) & 1).join('');
  const P = (m) => {
    if (m === 0) return 1;
    const v = pr[key(m)];
    if (v === undefined) throw new Error('venn: в pr нет вероятности «' + key(m) + '»');
    return evalParam(v, scope);
  };
  const full = (1 << n) - 1;
  const out = [];
  for (let s = 0; s <= full; s++) {
    let p = 0;
    for (let t = 0; t <= full; t++) {
      if ((t & s) !== s) continue; // T ⊇ S
      let bits = 0;
      for (let k = 0; k < n; k++) if (((t & ~s) >> k) & 1) bits++;
      p += (bits % 2 ? -1 : 1) * P(t);
    }
    out.push(Math.max(0, Number(p.toFixed(12))));
  }
  return out;
}

export function compute(params, scope, vars) {
  const out = { sel: vars.sel };
  if (params.pr) {
    const n = count(params);
    const probs = regionProbs(params.pr, n, scope);
    let P = 0;
    for (let r = 0; r < probs.length; r++) if ((vars.sel >> r) & 1) P += probs[r];
    out.P = Number(P.toFixed(12));
  }
  return out;
}

/** Круги в долях ширины холста: [cx, cy, r] */
function circles(n) {
  return n === 3
    ? [[0.4, 0.4, 0.22], [0.6, 0.4, 0.22], [0.5, 0.57, 0.22]]
    : [[0.38, 0.33, 0.24], [0.62, 0.33, 0.24]];
}

function rgb(hex, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  const h = m ? m[1] : fallback;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mount(el, { params, scope }, ctx = {}) {
  const th = theme();
  const n = count(params);
  const cs = circles(n);
  const probs = params.pr ? regionProbs(params.pr, n, scope) : null;
  let vars = initial(params);
  let v;

  /** Область точки в долях ширины: номер r. */
  const regionAt = (fx, fy) => {
    let r = 0;
    cs.forEach(([cx, cy, rad], k) => {
      if ((fx - cx) ** 2 + (fy - cy) ** 2 <= rad * rad) r |= 1 << k;
    });
    return r;
  };

  const draw = () => {
    const { ctx: c, w, h } = v;
    c.clearRect(0, 0, w, h);
    // универсум
    c.strokeStyle = th.muted;
    c.lineWidth = 1.5;
    c.strokeRect(2, 2, w - 4, h - 4);
    const k = w; // масштаб: доли ширины
    const [ar, ag, ab] = rgb(th.accent, '2563eb');
    // закраска по областям: перебор пикселей
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(w));
    tmp.height = Math.max(1, Math.round(h));
    const tc = /** @type {CanvasRenderingContext2D} */ (tmp.getContext('2d'));
    const img = tc.createImageData(tmp.width, tmp.height);
    const sums = Array.from({ length: 1 << n }, () => [0, 0, 0]);
    for (let y = 0; y < tmp.height; y++) {
      for (let x = 0; x < tmp.width; x++) {
        const r = regionAt(x / k, y / k);
        const s = sums[r];
        s[0] += x;
        s[1] += y;
        s[2]++;
        if ((vars.sel >> r) & 1) {
          const i = (y * tmp.width + x) * 4;
          img.data[i] = ar;
          img.data[i + 1] = ag;
          img.data[i + 2] = ab;
          img.data[i + 3] = 110;
        }
      }
    }
    tc.putImageData(img, 0, 0);
    c.drawImage(tmp, 0, 0, w, h);
    // контуры и подписи множеств
    c.lineWidth = 2.5;
    c.strokeStyle = th.fg;
    c.font = '600 18px system-ui, sans-serif';
    c.fillStyle = th.fg;
    c.textAlign = 'center';
    cs.forEach(([cx, cy, rad], i) => {
      c.beginPath();
      c.arc(cx * k, cy * k, rad * k, 0, Math.PI * 2);
      c.stroke();
      const lx = cx + (i === 0 ? -0.9 : i === 1 ? 0.9 : 0) * rad;
      const ly = cy + (i === 2 ? 1.25 : -1.15) * rad;
      c.fillText(NAMES[i], lx * k, ly * k);
    });
    // вероятности областей
    if (probs) {
      c.font = '13px system-ui, sans-serif';
      sums.forEach((s, r) => {
        if (!s[2]) return;
        const x = r === 0 ? 24 : s[0] / s[2];
        const y = r === 0 ? h - 14 : s[1] / s[2];
        c.fillStyle = th.fg;
        c.fillText(fmtNum(Number(probs[r].toPrecision(3))), x, y + 4);
      });
    }
    if (params.pr) {
      const o = compute(params, scope, vars);
      c.textAlign = 'left';
      c.font = '13px system-ui, sans-serif';
      c.fillStyle = th.fg;
      c.fillText(`P = ${fmtNum(Number(o.P.toPrecision(4)))}`, 10, 18);
    }
  };

  v = createView(el, { xr: [0, 1], yr: [0, 1], aspect: n === 3 ? 0.86 : 0.64, onResize: draw });

  if (params.tap) {
    v.canvas.style.touchAction = 'manipulation';
    v.canvas.addEventListener('click', (e) => {
      const [px, py] = v.pos(e);
      const r = regionAt(px / v.w, py / v.w);
      vars = { ...vars, sel: vars.sel ^ (1 << r) };
      draw();
      ctx.onChange?.({ sel: vars.sel });
    });
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
