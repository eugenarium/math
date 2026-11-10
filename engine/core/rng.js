// @ts-check
// Детерминированный генератор: один seed — одни и те же числа в задаче.

/** @param {number} seed */
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** целое из [lo, hi] */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** элемент массива */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** перемешанная копия */
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /** нормальное N(0,1), Бокс–Мюллер */
    normal: () => {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}
