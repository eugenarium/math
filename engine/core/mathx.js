// @ts-check
// Выражения уроков: math.js + функции из docs/ARCHITECTURE.md и schema/problem.schema.
import { create, all } from 'mathjs';
import jStat from 'jstat';

const math = create(all, { matrix: 'Array', number: 'number' });

const flat = (a) => (Array.isArray(a) ? a.flat(Infinity) : [a]);

/** @param {number[][]} M */
function rank(M) {
  const A = M.map((r) => r.slice());
  const rows = A.length;
  const cols = A[0]?.length ?? 0;
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = r;
    for (let i = r + 1; i < rows; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) < 1e-9) continue;
    [A[r], A[p]] = [A[p], A[r]];
    for (let i = r + 1; i < rows; i++) {
      const f = A[i][c] / A[r][c];
      for (let j = c; j < cols; j++) A[i][j] -= f * A[r][j];
    }
    r++;
  }
  return r;
}

function mean(a) {
  const x = flat(a);
  return x.reduce((s, v) => s + v, 0) / x.length;
}
function cov(a, b) {
  const x = flat(a);
  const y = flat(b);
  const mx = mean(x);
  const my = mean(y);
  return x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / (x.length - 1);
}
const variance = (a) => cov(a, a);

/** Подстановка переменной: строковое выражение f, значения переменных. */
function evalString(f, vars) {
  return math.compile(String(f)).evaluate({ ...vars });
}

math.import(
  {
    ln: (x) => Math.log(x),
    C: (n, k) => math.combinations(n, k),
    A: (n, k) => math.permutations(n, k),
    rank,
    cov,
    corr: (a, b) => cov(a, b) / Math.sqrt(variance(a) * variance(b)),
    // среднее, дисперсия и σ — по выборке (n−1)
    var: variance,
    std: (a) => Math.sqrt(variance(a)),
    normcdf: (x, mu, s) => jStat.normal.cdf(x, mu, s),
    norminv: (p, mu, s) => jStat.normal.inv(p, mu, s),
    tcdf: (x, df) => jStat.studentt.cdf(x, df),
    tinv: (p, df) => jStat.studentt.inv(p, df),
    chi2cdf: (x, df) => jStat.chisquare.cdf(x, df),
    chi2inv: (p, df) => jStat.chisquare.inv(p, df),
    fcdf: (x, a, b) => jStat.centralF.cdf(x, a, b),
    finv: (p, a, b) => jStat.centralF.inv(p, a, b),
    binompmf: (k, n, p) => jStat.binomial.pdf(k, n, p),
    binomcdf: (k, n, p) => jStat.binomial.cdf(k, n, p),
    poispmf: (k, l) => jStat.poisson.pdf(k, l),
    poiscdf: (k, l) => jStat.poisson.cdf(k, l),
    expcdf: (x, l) => (x < 0 ? 0 : 1 - Math.exp(-l * x)),
    unifcdf: (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a))),
    // Функции над строковыми выражениями: D(f,x), at(f,x,v), integ(f,x,a,b).
    // Имя переменной во втором аргументе превращается в строку при разборе (quoteVarArgs).
    D: (f, x) => math.derivative(String(f), String(x)).toString(),
    at: (f, x, v) => evalString(f, { [String(x)]: v }),
    integ: (f, x, a, b) => {
      const g = math.compile(String(f));
      const n = 2000;
      const h = (b - a) / n;
      const y = (t) => g.evaluate({ [String(x)]: t });
      let s = y(a) + y(b);
      for (let i = 1; i < n; i++) s += y(a + i * h) * (i % 2 ? 4 : 2);
      return (s * h) / 3;
    },
  },
  { override: true },
);

/** Имя переменной в D/at/integ → строковый литерал: D(f, x) → D(f, "x"); вложенные вызовы разбираются рекурсивно. */
export function quoteVarArgs(src) {
  const re = /\b(D|at|integ)\s*\(/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length;
    const args = [];
    let depth = 0;
    let start = open;
    let i = open;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0) {
        args.push(src.slice(start, i));
        start = i + 1;
      }
    }
    args.push(src.slice(start, i));
    const fixed = args.map((a, idx) => {
      const t = a.trim();
      return idx === 1 && /^[A-Za-z]\w*$/.test(t) ? `"${t}"` : quoteVarArgs(a);
    });
    out += src.slice(last, m.index) + m[1] + '(' + fixed.join(',') + ')';
    last = i + 1;
    re.lastIndex = last;
  }
  return out + src.slice(last);
}

const cache = new Map();
function compiled(src) {
  let c = cache.get(src);
  if (!c) {
    c = math.compile(quoteVarArgs(src));
    cache.set(src, c);
  }
  return c;
}

/**
 * Вычисляет выражение. Возвращает число, строку, булево или массив.
 * Комплексные и нечисловые результаты — исключение.
 * @param {string|number} expr
 * @param {Record<string, any>} [scope]
 */
export function evalExpr(expr, scope = {}) {
  if (typeof expr === 'number') return expr;
  const r = compiled(String(expr)).evaluate({ ...scope });
  return clean(r);
}

function clean(r) {
  if (typeof r === 'number') {
    if (!Number.isFinite(r)) throw new Error('результат не число: ' + r);
    return r;
  }
  if (typeof r === 'string' || typeof r === 'boolean') return r;
  if (Array.isArray(r)) return r.map(clean);
  if (r && typeof r === 'object' && 'isMatrix' in r) return clean(r.toArray());
  if (r && typeof r === 'object' && 'im' in r) {
    if (Math.abs(r.im) < 1e-12) return clean(r.re);
    throw new Error('комплексный результат');
  }
  if (r && typeof r.toNumber === 'function') return clean(r.toNumber());
  throw new Error('неподдерживаемый результат выражения');
}

/** Проверка синтаксиса и списка неизвестных имён: возвращает имена символов, которых нет в scope и в math.js. */
export function freeSymbols(expr, scopeNames = []) {
  const node = math.parse(quoteVarArgs(String(expr)));
  /** @type {Set<string>} */
  const bad = new Set();
  node.traverse((n, _path, parent) => {
    if (n.type === 'SymbolNode') {
      const name = n.name;
      const isFnCall = parent && parent.type === 'FunctionNode' && parent.fn === n;
      if (!isFnCall && !scopeNames.includes(name) && !(name in math)) bad.add(name);
    }
  });
  return [...bad];
}

export function toTex(expr) {
  return math.parse(String(expr)).toTex({ parenthesis: 'auto' });
}

export { math, jStat };
