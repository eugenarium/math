// @ts-check
// Рукописные заметки: векторные штрихи на листе фиксированной логической ширины.
// Хранятся отдельно от прогресса (localStorage['mx-notes']), чтобы запись штриха не переписывала весь прогресс.

export const PAGE_W = 1000;
export const PAGE_H0 = 1400;
export const PAGE_STEP = 800;
export const PAGE_MAX = 12000;
const KEY = 'mx-notes';

/**
 * Штрих: c — цвет (k чернила, b, r, g), w — толщина в логических единицах, p — плоский массив [x0, y0, x1, y1, …].
 * @typedef {{c: string, w: number, p: number[]}} Stroke
 * @typedef {{h: number, s: Stroke[]}} Page
 */

/** @returns {Page} */
export const emptyPage = () => ({ h: PAGE_H0, s: [] });

/** @returns {Record<string, Page>} */
export function loadNotes() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, Page>} all */
export function saveNotes(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/** Заменить заметки целиком (импорт копии). Разбирает только корректные листы. @param {any} raw */
export function importNotes(raw) {
  /** @type {Record<string, Page>} */
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [id, pg] of Object.entries(raw)) {
      if (!pg || typeof pg !== 'object' || !Array.isArray(pg.s)) continue;
      const s = pg.s.filter((x) => x && typeof x.c === 'string' && typeof x.w === 'number' && Array.isArray(x.p) && x.p.length >= 2 && x.p.every(Number.isFinite));
      out[id] = { h: Math.min(PAGE_MAX, Math.max(PAGE_H0, Number(pg.h) || PAGE_H0)), s };
    }
  }
  return out;
}

/** Расстояние от точки до отрезка. */
export function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/** Задевает ли круг радиуса r с центром в (x, y) штрих. @param {Stroke} st */
export function hitsStroke(st, x, y, r) {
  const p = st.p;
  const rr = r + st.w / 2;
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= rr;
  for (let i = 0; i + 3 < p.length; i += 2) if (distToSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= rr) return true;
  return false;
}

/** Округлить координаты до целых и убрать повторяющиеся точки: заметки остаются компактными. @param {number[]} p */
export function compactPath(p) {
  const out = [];
  for (let i = 0; i < p.length; i += 2) {
    const x = Math.round(p[i]);
    const y = Math.round(p[i + 1]);
    const n = out.length;
    if (n >= 2 && out[n - 2] === x && out[n - 1] === y) continue;
    out.push(x, y);
  }
  return out;
}

/** Нижняя граница рисунка: лист не короче этого значения. @param {Page} pg */
export function contentBottom(pg) {
  let m = 0;
  for (const st of pg.s) for (let i = 1; i < st.p.length; i += 2) m = Math.max(m, st.p[i] + st.w);
  return m;
}

/** Удалить лист (черновик задачи после завершения задачи). @param {string} id */
export function discardNote(id) {
  const all = loadNotes();
  if (id in all) {
    delete all[id];
    saveNotes(all);
  }
}
