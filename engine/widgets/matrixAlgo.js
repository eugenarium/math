// @ts-check
// Алгоритмы для виджета matrix: точная арифметика на дробях, шаги — строки с формулами в $…$.
// Каждая функция возвращает {steps: string[], result}; result нужен тестам.
import { math } from '../core/mathx.js';
import { fmtNum } from '../core/gen.js';

// ───── дроби ─────
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** @returns {[number, number]} */
const Q = (n, d = 1) => {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const toQ = (x) => {
  if (Number.isInteger(x)) return Q(x);
  const f = math.fraction(x);
  return Q(Number(f.s) * Number(f.n), Number(f.d));
};
const add = (a, b) => Q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const sub = (a, b) => Q(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const mul = (a, b) => Q(a[0] * b[0], a[1] * b[1]);
const div = (a, b) => Q(a[0] * b[1], a[1] * b[0]);
const neg = (a) => Q(-a[0], a[1]);
const isZero = (a) => a[0] === 0;
const isOne = (a) => a[0] === 1 && a[1] === 1;
const num = (a) => a[0] / a[1];
const ZERO = Q(0);
const ONE = Q(1);

const MINUS = '−';
/** TeX числа: дробью (frac) или десятичным */
const tq = (a, frac) => {
  if (a[1] === 1) return fmtNum(a[0]);
  if (!frac) return fmtNum(a[0] / a[1]);
  return `${a[0] < 0 ? MINUS : ''}\\frac{${Math.abs(a[0])}}{${a[1]}}`;
};
const tmat = (A, frac, split = -1) => {
  const rows = A.map((r) => r.map((x, j) => (j === split ? '\\mid ' : '') + tq(x, frac)).join(' & ').replace(/& \\mid /g, '& \\mid '));
  const cols = A[0].length;
  const spec = split > 0 ? `{${'c'.repeat(split)}|${'c'.repeat(cols - split)}}` : null;
  if (spec) return `\\left(\\begin{array}${spec} ${A.map((r) => r.map((x) => tq(x, frac)).join(' & ')).join(' \\\\ ')} \\end{array}\\right)`;
  return `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`;
};
const tvec = (v, frac) => tmat(v.map((x) => [x]), frac);

/** Подпись коэффициента при строке: «R_2 − 3R_1», «R_2 + \frac12 R_1» */
function rowOp(i, j, f, frac) {
  const a = Q(Math.abs(f[0]), f[1]);
  const coef = isOne(a) ? '' : tq(a, frac);
  return `R_${i + 1} \\leftarrow R_${i + 1} ${f[0] > 0 ? MINUS : '+'} ${coef}R_${j + 1}`;
}

const toQmat = (M) => M.map((r) => r.map(toQ));
const copy = (A) => A.map((r) => r.slice());
const numMat = (A) => A.map((r) => r.map(num));

/**
 * Гаусс (ref) или Гаусс–Жордан (rref) над первыми `coefCols` столбцами.
 * @returns {{steps: string[], A: any[][], rank: number, sign: number}}
 */
function reduce(M, { jordan, frac, coefCols, split = -1, steps = [] }) {
  const A = copy(M);
  const rows = A.length;
  coefCols ??= A[0].length;
  let r = 0;
  let sign = 1;
  const show = (note) => steps.push(`${note}: $${tmat(A, frac, split)}$`);
  for (let c = 0; c < coefCols && r < rows; c++) {
    let p = r;
    while (p < rows && isZero(A[p][c])) p++;
    if (p === rows) continue;
    if (p !== r) {
      [A[r], A[p]] = [A[p], A[r]];
      sign = -sign;
      show(`Переставим строки ${r + 1} и ${p + 1}`);
    }
    if (jordan && !isOne(A[r][c])) {
      const pivot = A[r][c];
      const k = div(ONE, pivot);
      A[r] = A[r].map((x) => mul(x, k));
      show(`Разделим строку ${r + 1} на $${tq(pivot, frac)}$`);
    }
    for (let i = jordan ? 0 : r + 1; i < rows; i++) {
      if (i === r || isZero(A[i][c])) continue;
      const f = div(A[i][c], A[r][c]);
      A[i] = A[i].map((x, k) => sub(x, mul(f, A[r][k])));
      show(`$${rowOp(i, r, f, frac)}$`);
    }
    r++;
  }
  return { steps, A, rank: r, sign };
}

// ───── операции ─────

export function gauss(M, frac = false, jordan = false) {
  const A0 = toQmat(M);
  const steps = [`Матрица: $${tmat(A0, frac)}$. ${jordan ? 'Приведём к улучшенному ступенчатому виду.' : 'Обнулим элементы под ведущими.'}`];
  const res = reduce(A0, { jordan, frac, steps });
  steps.push(`Готово${jordan ? '' : ': под ведущими элементами нули'}. Ранг равен ${res.rank}.`);
  return { steps, result: numMat(res.A), rank: res.rank };
}

export function det(M, frac = false) {
  const n = M.length;
  const A0 = toQmat(M);
  const steps = [`Матрица: $${tmat(A0, frac)}$. Приведём к треугольному виду: определитель не изменится от прибавления строки, а перестановка меняет знак.`];
  const res = reduce(A0, { jordan: false, frac, steps });
  let d = ONE;
  for (let i = 0; i < n; i++) d = mul(d, res.A[i][i]);
  d = res.sign < 0 ? neg(d) : d;
  const diag = res.A.map((r, i) => tq(r[i], frac)).join(' \\cdot ');
  steps.push(`Произведение диагонали${res.sign < 0 ? ' со знаком «минус» (нечётное число перестановок)' : ''}: $${res.sign < 0 ? MINUS : ''}${diag}=${tq(d, frac)}$.`);
  return { steps, result: num(d) };
}

export function inv(M, frac = false) {
  const n = M.length;
  const A0 = toQmat(M);
  const aug = A0.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO))]);
  const steps = [`Припишем справа единичную матрицу: $${tmat(aug, frac, n)}$. Цель — слева получить единичную.`];
  const res = reduce(aug, { jordan: true, frac, coefCols: n, split: n, steps });
  if (res.rank < n) {
    steps.push('Слева появилась нулевая строка: $\\det A=0$, обратной матрицы нет.');
    return { steps, result: null };
  }
  const I = res.A.map((r) => r.slice(n));
  steps.push(`Справа обратная матрица: $A^{-1}=${tmat(I, frac)}$.`);
  return { steps, result: numMat(I) };
}

export function mulM(M, B, frac = false) {
  const A = toQmat(M);
  const Bq = toQmat(B);
  const r = A.length;
  const k = A[0].length;
  const c = Bq[0].length;
  if (Bq.length !== k) throw new Error('matrix: размеры не согласованы для умножения');
  const steps = [`Умножаем $${tmat(A, frac)}\\cdot${tmat(Bq, frac)}$. Элемент $c_{ij}$ — строка $i$ первой матрицы на столбец $j$ второй.`];
  const C = Array.from({ length: r }, () => Array(c).fill(ZERO));
  for (let i = 0; i < r; i++) {
    const parts = [];
    for (let j = 0; j < c; j++) {
      let s = ZERO;
      const terms = [];
      for (let t = 0; t < k; t++) {
        s = add(s, mul(A[i][t], Bq[t][j]));
        terms.push(`${tq(A[i][t], frac)}\\cdot ${tq(Bq[t][j], frac)}`);
      }
      C[i][j] = s;
      parts.push(`c_{${i + 1}${j + 1}}=${terms.join('+')}=${tq(s, frac)}`);
    }
    steps.push(`Строка ${i + 1}: $${parts.join(',\\ ')}$.`);
  }
  steps.push(`Произведение: $${tmat(C, frac)}$.`);
  return { steps, result: numMat(C) };
}

export function transpose(M, frac = false) {
  const A = toQmat(M);
  const T = A[0].map((_, j) => A.map((r) => r[j]));
  return { steps: [`Строки становятся столбцами: $${tmat(A, frac)}^T=${tmat(T, frac)}$.`], result: numMat(T) };
}

export function lu(M, frac = false) {
  const n = M.length;
  const A = toQmat(M);
  const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO)));
  const steps = [`Раскладываем $A=LU$ без перестановок. Множители, на которые вычитаем строки, запишем в $L$.`];
  for (let c = 0; c < n; c++) {
    if (isZero(A[c][c])) {
      steps.push(`Ведущий элемент в столбце ${c + 1} равен нулю: без перестановки строк $LU$-разложения нет.`);
      return { steps, result: null };
    }
    for (let i = c + 1; i < n; i++) {
      if (isZero(A[i][c])) continue;
      const f = div(A[i][c], A[c][c]);
      L[i][c] = f;
      A[i] = A[i].map((x, k) => sub(x, mul(f, A[c][k])));
      steps.push(`$${rowOp(i, c, f, frac)}$, значит $l_{${i + 1}${c + 1}}=${tq(f, frac)}$. Сейчас $U=${tmat(A, frac)}$.`);
    }
  }
  steps.push(`Итог: $L=${tmat(L, frac)}$, $U=${tmat(A, frac)}$.`);
  return { steps, result: { L: numMat(L), U: numMat(A) } };
}

const dotQ = (a, b) => a.reduce((s, x, i) => add(s, mul(x, b[i])), ZERO);

/** Ортогонализация Грама–Шмидта столбцов (без нормировки). */
export function gramSchmidt(M, frac = false) {
  const A = toQmat(M);
  const vs = A[0].map((_, j) => A.map((r) => r[j]));
  const steps = [`Столбцы $v_1,\\dots,v_${vs.length}$. Вычитаем из каждого проекции на уже построенные $u_i$: $u_j=v_j-\\sum \\frac{(v_j\\cdot u_i)}{(u_i\\cdot u_i)}u_i$.`];
  /** @type {any[][]} */
  const us = [];
  vs.forEach((v, j) => {
    let u = v.slice();
    const parts = [];
    us.forEach((ui, i) => {
      const k = div(dotQ(v, ui), dotQ(ui, ui));
      parts.push(`${tq(k, frac)}\\,u_${i + 1}`);
      u = u.map((x, t) => sub(x, mul(k, ui[t])));
    });
    if (u.every(isZero)) {
      steps.push(`$u_${j + 1}=\\mathbf{0}$: вектор $v_${j + 1}$ линейно выражается через предыдущие, ортогональной системы из них не получить.`);
      us.push(u);
      return;
    }
    us.push(u);
    steps.push(j === 0 ? `$u_1=v_1=${tvec(u, frac)}$.` : `$u_${j + 1}=v_${j + 1}-${parts.join('-')}=${tvec(u, frac)}$.`);
  });
  const nz = us.filter((u) => !u.every(isZero));
  const checks = [];
  for (let i = 0; i < nz.length; i++) for (let k = i + 1; k < nz.length; k++) checks.push(`u_${i + 1}\\cdot u_${k + 1}=${tq(dotQ(nz[i], nz[k]), frac)}`);
  if (checks.length) steps.push(`Проверка: $${checks.join(',\\ ')}$.`);
  return { steps, result: us.map((u) => u.map(num)) };
}

const polyTex = (coeffs, frac) => {
  const n = coeffs.length - 1;
  let out = '';
  coeffs.forEach((c, i) => {
    if (isZero(c)) return;
    const deg = n - i;
    const a = Q(Math.abs(c[0]), c[1]);
    const body = deg === 0 ? tq(a, frac) : `${isOne(a) ? '' : tq(a, frac)}\\lambda${deg > 1 ? `^${deg}` : ''}`;
    out += out === '' ? `${c[0] < 0 ? MINUS : ''}${body}` : ` ${c[0] < 0 ? MINUS : '+'} ${body}`;
  });
  return out || '0';
};

/** Характеристический многочлен 2×2 и 3×3; result — коэффициенты от старшего. */
export function charPoly(M, frac = false) {
  const n = M.length;
  const A = toQmat(M);
  if (n > 3 || n < 2) throw new Error('matrix: char поддерживает матрицы 2×2 и 3×3');
  const AL = A.map((r, i) => r.map((x, j) => (i === j ? `${tq(x, frac)}${MINUS}\\lambda` : tq(x, frac))));
  const steps = [`Составим $A-\\lambda I=\\begin{pmatrix} ${AL.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{pmatrix}$ и найдём её определитель.`];
  const tr = A.reduce((s, r, i) => add(s, r[i]), ZERO);
  let coeffs;
  if (n === 2) {
    const d = sub(mul(A[0][0], A[1][1]), mul(A[0][1], A[1][0]));
    steps.push(`След $\\operatorname{tr}A=${tq(tr, frac)}$, определитель $\\det A=${tq(d, frac)}$. Для $2\\times2$: $\\det(A-\\lambda I)=\\lambda^2-\\operatorname{tr}A\\cdot\\lambda+\\det A$.`);
    coeffs = [ONE, neg(tr), d];
  } else {
    let c2 = ZERO;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) c2 = add(c2, sub(mul(A[i][i], A[j][j]), mul(A[i][j], A[j][i])));
    const d3 = sub(
      add(add(mul(A[0][0], sub(mul(A[1][1], A[2][2]), mul(A[1][2], A[2][1]))), mul(A[0][2], sub(mul(A[1][0], A[2][1]), mul(A[1][1], A[2][0])))), ZERO),
      mul(A[0][1], sub(mul(A[1][0], A[2][2]), mul(A[1][2], A[2][0]))),
    );
    steps.push(`След $\\operatorname{tr}A=${tq(tr, frac)}$, сумма главных миноров $2\\times2$ равна $${tq(c2, frac)}$, определитель $\\det A=${tq(d3, frac)}$. Для $3\\times3$: $\\det(\\lambda I-A)=\\lambda^3-\\operatorname{tr}A\\cdot\\lambda^2+c_2\\lambda-\\det A$.`);
    coeffs = [ONE, neg(tr), c2, neg(d3)];
  }
  steps.push(`Характеристический многочлен: $p(\\lambda)=${polyTex(coeffs, frac)}$.`);
  return { steps, result: coeffs.map(num) };
}

/** Шаги по операции. */
export function run(op, M, B, frac = false) {
  switch (op) {
    case 'gauss':
      return gauss(M, frac, false);
    case 'rref':
      return gauss(M, frac, true);
    case 'det':
      return det(M, frac);
    case 'inv':
      return inv(M, frac);
    case 'mul':
      return mulM(M, B, frac);
    case 'T':
      return transpose(M, frac);
    case 'lu':
      return lu(M, frac);
    case 'gs':
      return gramSchmidt(M, frac);
    case 'char':
      return charPoly(M, frac);
    default:
      throw new Error('matrix: неизвестная операция ' + op);
  }
}
