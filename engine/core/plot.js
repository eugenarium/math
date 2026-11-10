// @ts-check
// База 2D-графики на canvas: окно, оси, сетка, кривые. Без зависимостей от уроков и виджетов.
import { fmtNum } from './gen.js';

/** Цвета из CSS-переменных страницы (светлая и тёмная темы). */
export function theme() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n, d) => cs.getPropertyValue(n).trim() || d;
  return {
    fg: g('--fg', '#111827'),
    muted: g('--muted', '#6b7280'),
    line: g('--line', '#e5e7eb'),
    accent: g('--accent', '#2563eb'),
    ok: g('--ok', '#15803d'),
    bad: g('--bad', '#b91c1c'),
  };
}

export const ASPECT = { s: 0.5, m: 0.64, l: 0.85 };

/**
 * Холст в контейнере. Окно: xr, yr — изменяемые массивы [lo, hi].
 * @param {HTMLElement} host
 * @param {{xr: number[], yr: number[], aspect?: number, onResize?: () => void}} o
 */
export function createView(host, { xr, yr, aspect = ASPECT.m, onResize }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;display:block;border-radius:10px;touch-action:pan-y';
  host.appendChild(canvas);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const v = {
    canvas,
    ctx,
    xr,
    yr,
    w: 0,
    h: 0,
    /** x → пиксель */
    X: (x) => ((x - v.xr[0]) / (v.xr[1] - v.xr[0])) * v.w,
    /** y → пиксель */
    Y: (y) => v.h - ((y - v.yr[0]) / (v.yr[1] - v.yr[0])) * v.h,
    ix: (px) => v.xr[0] + (px / v.w) * (v.xr[1] - v.xr[0]),
    iy: (py) => v.yr[0] + ((v.h - py) / v.h) * (v.yr[1] - v.yr[0]),
    resize() {
      const cssW = Math.max(200, host.getBoundingClientRect().width);
      const cssH = Math.round(cssW * aspect);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = cssH + 'px';
      v.w = cssW;
      v.h = cssH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    /** позиция события в пикселях холста */
    pos(e) {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    },
    destroy() {
      ro.disconnect();
      canvas.remove();
    },
  };
  v.resize();
  const ro = new ResizeObserver(() => {
    v.resize();
    onResize?.();
  });
  ro.observe(host);
  return v;
}

/** «Красивый» шаг сетки: 1, 2 или 5 · 10^k */
export function niceStep(span, target = 6) {
  const raw = span / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Очищает холст, рисует сетку, оси и подписи. */
export function drawGrid(v, th) {
  const { ctx } = v;
  ctx.clearRect(0, 0, v.w, v.h);
  ctx.font = '11px system-ui, sans-serif';
  const sx = niceStep(v.xr[1] - v.xr[0]);
  const sy = niceStep(v.yr[1] - v.yr[0]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = th.line;
  ctx.fillStyle = th.muted;
  ctx.beginPath();
  for (let x = Math.ceil(v.xr[0] / sx) * sx; x <= v.xr[1] + 1e-9; x += sx) {
    ctx.moveTo(v.X(x), 0);
    ctx.lineTo(v.X(x), v.h);
  }
  for (let y = Math.ceil(v.yr[0] / sy) * sy; y <= v.yr[1] + 1e-9; y += sy) {
    ctx.moveTo(0, v.Y(y));
    ctx.lineTo(v.w, v.Y(y));
  }
  ctx.stroke();
  const ax = Math.min(Math.max(v.X(0), 0), v.w);
  const ay = Math.min(Math.max(v.Y(0), 0), v.h);
  ctx.strokeStyle = th.muted;
  ctx.beginPath();
  ctx.moveTo(0, ay);
  ctx.lineTo(v.w, ay);
  ctx.moveTo(ax, 0);
  ctx.lineTo(ax, v.h);
  ctx.stroke();
  const lab = (t, x, y, al) => {
    ctx.textAlign = al;
    ctx.fillText(t, x, y);
  };
  for (let x = Math.ceil(v.xr[0] / sx) * sx; x <= v.xr[1] + 1e-9; x += sx) {
    if (Math.abs(x) > 1e-9) lab(fmtNum(Number(x.toPrecision(6))), v.X(x), Math.min(ay + 13, v.h - 3), 'center');
  }
  for (let y = Math.ceil(v.yr[0] / sy) * sy; y <= v.yr[1] + 1e-9; y += sy) {
    if (Math.abs(y) > 1e-9) lab(fmtNum(Number(y.toPrecision(6))), Math.min(ax + 4, v.w - 24), v.Y(y) - 3, 'left');
  }
}

/**
 * Кривая y = f(x); разрывы и точки вне области определения разрывают линию.
 * @param {(x:number)=>number} f
 */
export function plotFn(v, f, color, width = 2.5) {
  const { ctx } = v;
  const n = Math.ceil(v.w * 1.5);
  const span = v.yr[1] - v.yr[0];
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let pen = false;
  let prev = NaN;
  for (let i = 0; i <= n; i++) {
    const x = v.xr[0] + ((v.xr[1] - v.xr[0]) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e7) {
      pen = false;
      prev = NaN;
      continue;
    }
    if (pen && Math.abs(y - prev) > 3 * span) pen = false; // асимптота
    if (pen) ctx.lineTo(v.X(x), v.Y(y));
    else ctx.moveTo(v.X(x), v.Y(y));
    pen = true;
    prev = y;
  }
  ctx.stroke();
}

/** Прямая через точку с наклоном m. */
export function plotLine(v, x0, y0, m, color, width = 2, dash = []) {
  const { ctx } = v;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(v.X(v.xr[0]), v.Y(y0 + m * (v.xr[0] - x0)));
  ctx.lineTo(v.X(v.xr[1]), v.Y(y0 + m * (v.xr[1] - x0)));
  ctx.stroke();
  ctx.setLineDash([]);
}

export function dot(v, x, y, color, r = 5) {
  const { ctx } = v;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(v.X(x), v.Y(y), r, 0, Math.PI * 2);
  ctx.fill();
}

export function label(v, text, x, y, color, align = 'left') {
  v.ctx.font = '13px system-ui, sans-serif';
  // подложка, чтобы подпись не сливалась с осями и подписями шкалы
  const w = v.ctx.measureText(text).width;
  v.ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
  v.ctx.globalAlpha = 0.85;
  v.ctx.fillRect(align === 'left' ? x - 4 : x - w - 4, y - 14, w + 8, 20);
  v.ctx.globalAlpha = 1;
  v.ctx.fillStyle = color;
  v.ctx.textAlign = align;
  v.ctx.fillText(text, x, y);
}

/** Окно по значениям кривой на [lo, hi] с запасом; пустые значения игнорируются. */
export function autoRange(f, lo, hi, extra = []) {
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const y = f(lo + ((hi - lo) * i) / 200);
    if (Number.isFinite(y) && Math.abs(y) < 1e4) {
      mn = Math.min(mn, y);
      mx = Math.max(mx, y);
    }
  }
  for (const y of extra) {
    mn = Math.min(mn, y);
    mx = Math.max(mx, y);
  }
  if (!Number.isFinite(mn)) return [-5, 5];
  if (mn > 0 && mn < (mx - mn) * 0.5) mn = Math.min(mn, 0);
  if (mx < 0 && -mx < (mx - mn) * 0.5) mx = Math.max(mx, 0);
  const pad = Math.max((mx - mn) * 0.12, 0.5);
  return [mn - pad, mx + pad];
}
