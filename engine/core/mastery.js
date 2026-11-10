// @ts-check
// Критерий усвоения и выбор следующей задачи (docs/SPEC.md, 2.3–2.4).
import { makeRng } from './rng.js';
import { PLAYABLE } from './gen.js';

export const MAX_TASKS = 15;

/**
 * Шаблоны, которые движок умеет показать.
 * @param {Record<string, any>} pr
 */
export function playableIds(pr) {
  return Object.keys(pr).filter((id) => PLAYABLE.has(pr[id].k));
}

/**
 * История: [{pid, ok}] — ok = верно с первой попытки и без подсказок.
 * Урок пройден: ≥4 из последних 5 верно, и каждый шаблон уровня ≥2 решён верно хотя бы раз.
 * @param {{pid: string, ok: boolean}[]} hist @param {Record<string, any>} pr
 */
export function isMastered(hist, pr) {
  const ids = playableIds(pr);
  if (hist.length < 5) return false;
  const last5 = hist.slice(-5);
  if (last5.filter((h) => h.ok).length < 4) return false;
  return ids.filter((id) => (pr[id].lv ?? 1) >= 2).every((id) => hist.some((h) => h.pid === id && h.ok));
}

/** Урок надо отложить: не достигнут критерий за MAX_TASKS задач. */
export const isStuck = (hist, pr) => hist.length >= MAX_TASKS && !isMastered(hist, pr);

/**
 * Текущий уровень: растёт после двух верных подряд на уровне, падает после двух ошибок подряд.
 * @param {{pid: string, ok: boolean}[]} hist @param {Record<string, any>} pr
 */
export function currentLevel(hist, pr) {
  const ids = playableIds(pr);
  const maxLv = Math.max(1, ...ids.map((id) => pr[id].lv ?? 1));
  let lv = 1;
  let streakOk = 0;
  let streakBad = 0;
  for (const h of hist) {
    if (h.ok) {
      streakOk++;
      streakBad = 0;
      if (streakOk >= 2 && lv < maxLv) {
        lv++;
        streakOk = 0;
      }
    } else {
      streakBad++;
      streakOk = 0;
      if (streakBad >= 2 && lv > 1) {
        lv--;
        streakBad = 0;
      }
    }
  }
  return lv;
}

/**
 * Следующая задача: шаблон текущего уровня (ближайший по уровню), без повтора предыдущего,
 * чаще те, что решены неверно. Возвращает {pid, seed}.
 * @param {{pid: string, ok: boolean}[]} hist @param {Record<string, any>} pr @param {number} salt
 */
export function pickNext(hist, pr, salt = 0) {
  const ids = playableIds(pr);
  const lv = currentLevel(hist, pr);
  const rng = makeRng(hist.length * 977 + salt + 1);
  const dist = (id) => Math.abs((pr[id].lv ?? 1) - lv);
  const best = Math.min(...ids.map(dist));
  let pool = ids.filter((id) => dist(id) === best);
  const last = hist.at(-1)?.pid;
  if (pool.length > 1) pool = pool.filter((id) => id !== last);
  // сначала то, что ещё не решено верно
  const unsolved = pool.filter((id) => !hist.some((h) => h.pid === id && h.ok));
  if (unsolved.length) pool = unsolved;
  return { pid: rng.pick(pool), seed: salt * 1000 + hist.length + 1 };
}
