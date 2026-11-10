// @ts-check
// Прогресс на устройстве: один ключ localStorage['mx'], записывается целиком после каждого ответа.

const KEY = 'mx';
const FRESH = () => ({ v: 1, L: {}, T: {}, E: {}, cur: null, xp: 0, set: {} });

/** Пустой прогресс. */
export const fresh = FRESH;

/** @returns {ReturnType<typeof FRESH>} */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return FRESH();
    const d = JSON.parse(raw);
    return d && d.v === 1 ? { ...FRESH(), ...d } : FRESH();
  } catch {
    return FRESH();
  }
}

/** @param {ReturnType<typeof FRESH>} state */
export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* хранилище недоступно: работаем без сохранения */
  }
}

export const LESSON_NEW = undefined;
export const LESSON_STARTED = 0;
export const LESSON_DONE = 1;
export const LESSON_RETURN = 2;

/** Урок открыт, когда пройдены все предпосылки. @param {any} state @param {string[]} pre */
export function isUnlocked(state, pre) {
  return pre.every((id) => state.L[id]?.[0] === LESSON_DONE);
}

export function setLessonStatus(state, id, st) {
  const prev = state.L[id] ?? [st, 0, 0, 0];
  state.L[id] = [st, prev[1], prev[2], prev[3]];
}

/** Счётчик по шаблону задачи: [верно, неверно]. */
export function recordProblem(state, lessonId, pid, ok) {
  const key = `${lessonId}#${pid}`;
  const t = state.T[key] ?? [0, 0];
  t[ok ? 0 : 1]++;
  state.T[key] = t;
}

export function recordMisconception(state, eid) {
  state.E[eid] = (state.E[eid] ?? 0) + 1;
}

export function exportJson(state) {
  return JSON.stringify(state, null, 2);
}

/** @param {string} text */
export function importJson(text) {
  const d = JSON.parse(text);
  if (!d || d.v !== 1) throw new Error('Неверный формат файла');
  return { ...FRESH(), ...d };
}
