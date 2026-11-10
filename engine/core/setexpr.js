// @ts-check
// Выражения над множествами для диаграмм Венна: A & !B, (A | B) & !C, A ^ B.
// Приоритет: ! выше & выше ^ выше |. Разбор рекурсивным спуском, без eval.

/**
 * @typedef {{t: 'var', name: string} | {t: 'not', x: Node} | {t: 'bin', op: string, a: Node, b: Node}} Node
 */

/** @param {string} src @returns {Node} */
export function parseSetExpr(src) {
  const toks = String(src).match(/[A-Za-z]+|[&|!^()\\]/g) ?? [];
  if (toks.join('') !== String(src).replace(/\s+/g, '')) throw new Error('venn: недопустимый символ в выражении «' + src + '»');
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];

  const atom = () => {
    const t = next();
    if (t === '(') {
      const e = or();
      if (next() !== ')') throw new Error('venn: нет закрывающей скобки в «' + src + '»');
      return e;
    }
    if (t === '!') return { t: 'not', x: atom() };
    if (t && /^[A-Za-z]+$/.test(t)) return { t: 'var', name: t };
    throw new Error('venn: ошибка в выражении «' + src + '»');
  };
  const and = () => {
    let a = atom();
    while (peek() === '&' || peek() === '\\') {
      const op = next();
      a = { t: 'bin', op, a, b: atom() };
    }
    return a;
  };
  const xor = () => {
    let a = and();
    while (peek() === '^') {
      next();
      a = { t: 'bin', op: '^', a, b: and() };
    }
    return a;
  };
  const or = () => {
    let a = xor();
    while (peek() === '|') {
      next();
      a = { t: 'bin', op: '|', a, b: xor() };
    }
    return a;
  };
  const ast = or();
  if (i !== toks.length) throw new Error('venn: лишние символы в «' + src + '»');
  return ast;
}

/** @param {Node} n @param {Record<string, boolean>} vars */
export function evalSetExpr(n, vars) {
  switch (n.t) {
    case 'var':
      if (!(n.name in vars)) throw new Error('venn: неизвестное множество ' + n.name);
      return vars[n.name];
    case 'not':
      return !evalSetExpr(n.x, vars);
    default: {
      const a = evalSetExpr(n.a, vars);
      const b = evalSetExpr(n.b, vars);
      if (n.op === '&') return a && b;
      if (n.op === '|') return a || b;
      if (n.op === '^') return a !== b;
      return a && !b; // A \ B
    }
  }
}

const NAMES = ['A', 'B', 'C'];

/**
 * Битовая маска областей диаграммы: бит r установлен, если выражение истинно в области r.
 * Область r: бит 0 — «лежит в A», бит 1 — в B, бит 2 — в C; область 0 — вне всех множеств.
 * @param {string} src @param {number} n число множеств (2 или 3)
 */
export function vmask(src, n = 2) {
  const ast = parseSetExpr(src);
  let mask = 0;
  for (let r = 0; r < 1 << n; r++) {
    const vars = {};
    for (let k = 0; k < n; k++) vars[NAMES[k]] = !!((r >> k) & 1);
    if (evalSetExpr(ast, vars)) mask |= 1 << r;
  }
  return mask;
}
