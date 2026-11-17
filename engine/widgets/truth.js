// @ts-check
// Таблицы истинности: формулы с переменными p, q, r…, связки ! & | ^ -> <->; заполнение итогового столбца, сравнение формул.
import { theme } from '../core/plot.js';

export const meta = {
  name: 'truth',
  params: {
    f: ['str|str[]', null, 'формулы: «p -> (q | !p)»; список — несколько столбцов'],
    fill: ['flag', null, '1 — ученик заполняет столбец первой формулы касанием ячеек'],
    cmp: ['flag', null, '1 — показать, равносильны ли формулы списка'],
  },
  out: ['ok', 'taut', 'eq', 'ones', 'bits', 'set'],
};

const TOKENS = /\s*(<->|->|[()!&|^]|[a-z])/gy;

/** Разбор формулы в дерево. Приоритет: ! выше & выше ^ выше | выше -> (правоассоциативна) выше <->. */
export function parse(src) {
  const toks = [];
  TOKENS.lastIndex = 0;
  let m;
  let pos = 0;
  const s = String(src);
  while (pos < s.length && (m = TOKENS.exec(s))) {
    toks.push(m[1]);
    pos = TOKENS.lastIndex;
  }
  if (s.slice(pos).trim()) throw new Error('truth: не удалось разобрать «' + s + '»');
  let i = 0;
  const peek = () => toks[i];
  const eat = () => toks[i++];
  const atom = () => {
    const t = eat();
    if (t === '!') return { op: '!', a: atom() };
    if (t === '(') {
      const e = iff();
      if (eat() !== ')') throw new Error('truth: нет закрывающей скобки в «' + s + '»');
      return e;
    }
    if (/^[a-z]$/.test(t ?? '')) return { v: t };
    throw new Error('truth: неожиданный символ в «' + s + '»');
  };
  const bin = (next, ops) => () => {
    let l = next();
    while (ops.includes(peek())) {
      const op = eat();
      l = { op, a: l, b: next() };
    }
    return l;
  };
  const and = bin(atom, ['&']);
  const xor = bin(and, ['^']);
  const or = bin(xor, ['|']);
  const imp = () => {
    const l = or();
    if (peek() === '->') {
      eat();
      return { op: '->', a: l, b: imp() };
    }
    return l;
  };
  const iff = bin(imp, ['<->']);
  const tree = iff();
  if (i < toks.length) throw new Error('truth: лишние символы в «' + s + '»');
  return tree;
}

export function varsOf(tree, acc = new Set()) {
  if (tree.v) acc.add(tree.v);
  else {
    varsOf(tree.a, acc);
    if (tree.b) varsOf(tree.b, acc);
  }
  return acc;
}

export function evalTree(t, env) {
  if (t.v) return !!env[t.v];
  const a = evalTree(t.a, env);
  if (t.op === '!') return !a;
  const b = evalTree(t.b, env);
  switch (t.op) {
    case '&': return a && b;
    case '|': return a || b;
    case '^': return a !== b;
    case '->': return !a || b;
    default: return a === b; // <->
  }
}

const list = (params) => (Array.isArray(params.f) ? params.f : [params.f ?? 'p']);

/** Таблица: имена переменных, строки (порядок: от 11…1 к 00…0, как в учебниках) и значения формул по строкам. */
export function table(params) {
  const trees = list(params).map(parse);
  const names = [...new Set(trees.flatMap((t) => [...varsOf(t)]))].sort();
  const rows = [];
  const n = names.length;
  for (let k = 0; k < 1 << n; k++) {
    const env = {};
    names.forEach((v, j) => (env[v] = !!((k >> (n - 1 - j)) & 1) ? 0 : 1));
    // порядок строк: сначала все 1
    rows.push(Object.fromEntries(Object.entries(env).map(([a, b]) => [a, !!b])));
  }
  const vals = trees.map((t) => rows.map((r) => evalTree(t, r)));
  return { names, rows, vals, srcs: list(params) };
}

export function controls() {
  return [];
}

export function initial(params) {
  return params.fill ? { bits: 0, set: 0 } : {};
}

export function compute(params, scope, vars) {
  const { vals } = table(params);
  const ones = vals[0].filter(Boolean).length;
  const taut = vals[0].every(Boolean) ? 1 : 0;
  const eq = vals.every((col) => col.every((x, i) => x === vals[0][i])) ? 1 : 0;
  let ok = 1;
  if (params.fill) {
    const need = (1 << vals[0].length) - 1;
    const bits = vals[0].reduce((m, x, i) => m | (x ? 1 << i : 0), 0);
    ok = vars.set === need && vars.bits === bits ? 1 : 0;
  }
  return { ok, taut, eq, ones, bits: vars.bits ?? 0, set: vars.set ?? 0 };
}

/** Ось перебора для достижимости цели: любые значения итогового столбца. */
export function dragAxes(params) {
  if (!params.fill) return [];
  const rows = 1 << table(params).names.length;
  const full = (1 << rows) - 1;
  return [Array.from({ length: Math.min(1 << rows, 4096) }, (_, m) => ({ bits: m, set: full }))];
}

export function mount(el, { params }, ctx = {}) {
  const th = theme();
  const T = table(params);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'overflow-x:auto';
  el.appendChild(wrap);
  let vars = initial(params);
  const cell = (txt, style = '') => `<td style="padding:6px 10px;text-align:center;border:1px solid ${th.line};${style}">${txt}</td>`;
  const draw = () => {
    const head = T.names.map((v) => `<th style="padding:6px 10px;border:1px solid ${th.line}">${v}</th>`).join('') + T.srcs.map((s) => `<th style="padding:6px 10px;border:1px solid ${th.line};color:${th.accent}">${s.replace(/&/g, '∧').replace(/\|/g, '∨').replace(/<->/g, '↔').replace(/->/g, '→').replace(/!/g, '¬').replace(/\^/g, '⊕')}</th>`).join('');
    const body = T.rows
      .map((r, i) => {
        const vs = T.names.map((v) => cell(r[v] ? '1' : '0')).join('');
        const cols = T.vals
          .map((col, j) => {
            if (params.fill && j === 0) {
              const set = (vars.set >> i) & 1;
              const val = (vars.bits >> i) & 1;
              return `<td data-row="${i}" style="padding:6px 10px;text-align:center;border:1px solid ${th.accent};cursor:pointer;min-width:2.2em;font-weight:600">${set ? val : '?'}</td>`;
            }
            return cell(col[i] ? '1' : '0', `font-weight:600;color:${col[i] ? th.ok : th.bad}`);
          })
          .join('');
        return `<tr>${vs}${cols}</tr>`;
      })
      .join('');
    const note = params.cmp && T.vals.length > 1 ? `<p style="margin:8px 0 0;font-weight:600;color:${T.vals.every((c) => c.every((x, i) => x === T.vals[0][i])) ? th.ok : th.bad}">${T.vals.every((c) => c.every((x, i) => x === T.vals[0][i])) ? 'Формулы равносильны: столбцы совпадают' : 'Формулы не равносильны: столбцы различаются'}</p>` : '';
    wrap.innerHTML = `<table style="border-collapse:collapse;margin:0 auto;font-variant-numeric:tabular-nums"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${note}`;
  };
  draw();
  wrap.addEventListener('click', (e) => {
    const td = /** @type {HTMLElement} */ (e.target).closest('[data-row]');
    if (!td || !params.fill) return;
    const i = Number(td.getAttribute('data-row'));
    const set = (vars.set >> i) & 1;
    const val = (vars.bits >> i) & 1;
    // ? → 1 → 0 → 1 …
    const nextVal = set ? 1 - val : 1;
    vars = { set: vars.set | (1 << i), bits: (vars.bits & ~(1 << i)) | (nextVal << i) };
    draw();
    ctx.onChange?.(vars);
  });
  return {
    update(next) {
      vars = { ...vars, ...next };
      draw();
    },
    destroy() {
      wrap.remove();
    },
  };
}
