// @ts-check
// Повторения с интервалами (docs/SPEC.md, 2.5): чистые функции над прогрессом L.
// L[id] = [st, box, due, n]: st 1 — пройден; box — номер интервала; due — день следующего повторения; n — число повторений.
import { makeRng } from './rng.js';
import { playableIds } from './mastery.js';

export const INTERVALS = [1, 3, 7, 16, 35, 80, 180];
export const EXAM_BOX = 2; // экзамен экстерном: сразу интервал 7 дней
export const SESSION_LESSONS = 10;
export const TASKS_PER_LESSON = 3;
export const DEBT_WARNING = 20;

const EPOCH = Date.UTC(2025, 0, 1);

/** Номер дня от 2025-01-01 по местному времени. @param {Date} [date] */
export function dayNumber(date = new Date()) {
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / 86400000);
}

/** Запись о только что пройденном уроке. @returns {[number, number, number, number]} */
export function onMastered(today, extern = false) {
  const box = extern ? EXAM_BOX : 0;
  return [1, box, today + INTERVALS[box], 0];
}

/**
 * Итог повторения: 3 из 3 — следующий интервал; на один меньше — тот же; иначе на два шага назад.
 * @param {number[]} entry @param {number} right @param {number} of @param {number} today
 * @returns {[number, number, number, number]}
 */
export function grade(entry, right, of, today) {
  let box = entry[1] ?? 0;
  if (right === of) box = Math.min(box + 1, INTERVALS.length - 1);
  else if (right < of - 1) box = Math.max(box - 2, 0);
  return [1, box, today + INTERVALS[box], (entry[3] ?? 0) + 1];
}

/** Уроки к повторению: пройденные, срок наступил; самые просроченные первыми. */
export function dueLessons(L, today) {
  return Object.keys(L)
    .filter((id) => L[id][0] === 1 && L[id][2] <= today)
    .sort((a, b) => L[a][2] - L[b][2] || a.localeCompare(b));
}

/**
 * Задачи повторения урока: n разных шаблонов; в приоритете уровень 2+ и шаблоны с ошибками.
 * @param {Record<string, any>} pr @param {Record<string, number[]>} T @param {string} lessonId
 */
export function pickReview(pr, T, lessonId, n, salt) {
  const rng = makeRng(salt + 17);
  const scored = playableIds(pr).map((pid) => {
    const [ok, bad] = T[`${lessonId}#${pid}`] ?? [0, 0];
    const errRate = ok + bad ? bad / (ok + bad) : 0;
    return { pid, score: ((pr[pid].lv ?? 1) >= 2 ? 2 : 0) + errRate * 3 + rng.next() };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((s, i) => ({ pid: s.pid, seed: salt * 100 + i + 1 }));
}

/**
 * Сессия дня: до 10 уроков к повторению, по 3 задачи, задачи разных уроков перемешаны.
 * @returns {{id: string, pid: string, seed: number}[]}
 */
export function buildSession(L, lessons, T, today, salt) {
  const ids = dueLessons(L, today).filter((id) => lessons[id]).slice(0, SESSION_LESSONS);
  const items = ids.flatMap((id, k) => pickReview(lessons[id].pr, T, id, TASKS_PER_LESSON, salt + k).map((t) => ({ id, ...t })));
  return makeRng(salt).shuffle(items);
}

/** Экзамен экстерном: до 4 задач максимального уровня, без повторов шаблонов, пока их хватает. */
export function pickExam(pr, salt, n = 4) {
  const rng = makeRng(salt + 31);
  const ids = playableIds(pr);
  const maxLv = Math.max(...ids.map((id) => pr[id].lv ?? 1));
  const top = rng.shuffle(ids.filter((id) => (pr[id].lv ?? 1) === maxLv));
  const rest = rng.shuffle(ids.filter((id) => (pr[id].lv ?? 1) !== maxLv)).sort((a, b) => (pr[b].lv ?? 1) - (pr[a].lv ?? 1));
  const order = [...top, ...rest];
  return Array.from({ length: n }, (_, i) => ({ pid: order[i % order.length], seed: salt * 100 + i + 1 }));
}
