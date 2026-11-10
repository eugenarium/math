// Линтер контента: коды E и W из docs/ARCHITECTURE.md, раздел 8.
// Использует те же gen/check/mathx, что и приложение: расхождений с рантаймом быть не может.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { loadContent } from './build.mjs';
import { instantiate } from '../engine/core/gen.js';
import { checkAnswer } from '../engine/core/check.js';
import { freeSymbols } from '../engine/core/mathx.js';
import { loaders } from '../engine/widgets/index.js';
import { goalReachable } from '../engine/widgets/kit.js';

export const SEEDS = 200;
export const W503_LIMIT = 6000;
const STOP = ['очевидно', 'легко видеть', 'нетрудно показать', 'как известно', 'просто', 'тривиально', 'давайте'];
const COMMON_WIDGET_KEYS = ['w', 'cap', 'ask', 'ans', 'h', 'ro'];

const FIELDS = {
  common: ['k', 'lv', 'v', 'c', 'q', 'h', 'sol', 'e', 'fast', 'est'],
  num: ['a', 'tol', 'u'],
  mc: ['a', 'x', 'n'],
  expr: ['a', 'vars', 'dom', 'const'],
  graph: ['w', 'goal'],
  spot: ['steps', 'from', 'bad'],
  proof: ['steps', 'mode', 'grp'],
  sim: ['w', 'goal', 'a', 'tol', 'min'],
};

/** Имена виджетов и их out из docs/WIDGETS.md */
export function parseWidgetDoc(text) {
  /** @type {Record<string, string[]>} */
  const widgets = {};
  const parts = text.split(/^### /m).slice(1);
  for (const part of parts) {
    const name = /^(\w+)/.exec(part)?.[1];
    if (!name) continue;
    const out = /\*\*out:\*\*([^\n]*)/.exec(part)?.[1] ?? '';
    widgets[name] = [...out.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  }
  return widgets;
}

/** Все строки объекта, кроме идентификаторов. */
function strings(o, out = []) {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => strings(x, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (k !== 'id') strings(v, out);
  return out;
}

const mathParts = (t) => [...String(t).matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);

function widgetsOf(L) {
  /** @type {{path: string, w: any}[]} */
  const found = [];
  const walk = (o, path) => {
    if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (o && typeof o === 'object') {
      if (typeof o.w === 'string') found.push({ path, w: o });
      else for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k);
      if (typeof o.w === 'object') found.push({ path: path + '.w', w: o.w });
    }
  };
  walk(L.int, 'int');
  walk(L.def, 'def');
  walk(L.ex, 'ex');
  for (const [pid, p] of Object.entries(L.pr)) {
    if (p.w) found.push({ path: `pr.${pid}.w`, w: p.w });
    walk(p.sol, `pr.${pid}.sol`);
  }
  return found.filter((f, i, a) => a.findIndex((g) => g.path === f.path) === i);
}

/**
 * Линтер одного урока.
 * @returns {{code: string, path: string, msg: string}[]}
 */
export function lintLesson(L, card, ctx) {
  const res = [];
  const add = (code, path, msg) => res.push({ code, path, msg });

  // ───── E2xx: ссылки ─────
  for (const [path, node] of walkNodes(L)) {
    if (node.g && typeof node.g === 'string' && !ctx.glossary[node.g]) add('E203', path, `нет в глоссарии: ${node.g}`);
    if (node.x && typeof node.x === 'string') {
      const p = L.pr[node.x];
      if (!p) add('E205', path, `нет задачи ${node.x}`);
      else if (!p.sol?.length) add('E205', path, `у задачи ${node.x} нет sol`);
    }
  }
  for (const g of card?.g ?? []) if (!ctx.glossary[g]) add('E203', 'card.g', `нет в глоссарии: ${g}`);
  for (const [i, e] of (L.err ?? []).entries()) if (!ctx.errors[e]) add('E204', `err[${i}]`, `нет в errors.yml: ${e}${hint(e, ctx.errors)}`);
  for (const [pid, p] of Object.entries(L.pr)) {
    if (p.from && !L.pr[p.from]) add('E205', `pr.${pid}.from`, `нет задачи ${p.from}`);
    else if (p.from && !L.pr[p.from].sol?.length) add('E205', `pr.${pid}.from`, `у задачи ${p.from} нет sol`);
  }

  // ───── E207: требования карточки ─────
  if (card) {
    const kinds = new Set(Object.values(L.pr).map((p) => p.k));
    for (const k of card.k ?? []) if (!kinds.has(k)) add('E207', 'pr', `нет задачи типа ${k}`);
    const used = new Set(widgetsOf(L).map((f) => f.w.w));
    for (const w of card.w ?? []) if (!used.has(w)) add('E207', 'int', `не использован виджет ${w}`);
    const diag = new Set();
    for (const p of Object.values(L.pr)) {
      Object.keys(p.e ?? {}).forEach((e) => diag.add(e));
      (p.bad ?? []).forEach((b) => b.e && diag.add(b.e));
    }
    for (const e of card.e ?? []) {
      if (!(L.err ?? []).includes(e)) add('E207', 'err', `в err нет заблуждения ${e}`);
      if (!diag.has(e)) add('E207', 'pr', `заблуждение ${e} не встречается в диагностике e или bad`);
    }
    if (card.n && Object.keys(L.pr).length !== card.n) add('E207', 'pr', `в карточке n=${card.n}, а задач ${Object.keys(L.pr).length}`);
  }

  // ───── E4xx: виджеты ─────
  for (const { path, w } of widgetsOf(L)) {
    if (!(w.w in ctx.widgetDoc)) {
      add('E401', path, `виджета нет в реестре: ${w.w}`);
      continue;
    }
    if (card?.w && !card.w.includes(w.w)) add('E403', path, `виджет ${w.w} не разрешён карточкой`);
    const mod = ctx.modules[w.w];
    if (mod) {
      const known = new Set([...Object.keys(mod.meta.params), ...COMMON_WIDGET_KEYS]);
      for (const k of Object.keys(w)) if (!known.has(k)) add('E402', `${path}.${k}`, `неизвестный параметр виджета ${w.w}: ${k}`);
    }
  }

  // ───── задачи ─────
  for (const [pid, p] of Object.entries(L.pr)) lintProblem(L, pid, p, ctx, add);

  // ───── W5xx ─────
  const all = strings(L);
  const len = JSON.stringify(L).length;
  if (ctx.rawLength?.[L.id] > W503_LIMIT) add('W503', '', `урок длиннее ${W503_LIMIT} знаков: ${ctx.rawLength[L.id]}`);
  else if (!ctx.rawLength && len > W503_LIMIT) add('W503', '', `урок длиннее ${W503_LIMIT} знаков: ${len}`);
  for (const t of all) {
    for (const m of mathParts(t)) if (m.length > 70) add('W502', '', `формула, вероятно, шире экрана: $${m.slice(0, 40)}…$`);
    const low = t.toLowerCase();
    for (const w of STOP) if (new RegExp(`(^|[^а-яё])${w}([^а-яё]|$)`).test(low)) add('W507', '', `стоп-слово «${w}»: ${t.slice(0, 50)}`);
  }
  if (!Object.values(L.pr).some((p) => p.fast)) add('W505', 'pr', 'нет ни одной задачи fast');
  if (!Object.values(L.pr).some((p) => (p.lv ?? 1) >= 2)) add('W506', 'pr', 'нет задачи уровня 2 или выше');
  return res;
}

function* walkNodes(o, path = '') {
  if (Array.isArray(o)) for (const [i, x] of o.entries()) yield* walkNodes(x, `${path}[${i}]`);
  else if (o && typeof o === 'object') {
    yield [path, o];
    for (const [k, v] of Object.entries(o)) yield* walkNodes(v, path ? `${path}.${k}` : k);
  }
}

function hint(id, table) {
  const near = Object.keys(table).find((k) => k.startsWith(id.slice(0, Math.max(3, id.length - 2))));
  return near ? ` (возможно: ${near})` : '';
}

const typed = (inst) =>
  inst.a.replace(/\b[A-Za-z]\w*\b/g, (n) => (n in inst.scope ? '(' + inst.scope[n] + ')' : n));

function lintProblem(L, pid, p, ctx, add) {
  const at = (f) => `pr.${pid}${f ? '.' + f : ''}`;

  // E306: поле не от того типа
  const allowed = new Set([...FIELDS.common, ...(FIELDS[p.k] ?? [])]);
  for (const f of Object.keys(p)) if (!allowed.has(f)) add('E306', at(f), `поле ${f} не относится к типу ${p.k}`);

  // E309: нет sol
  if ((p.k === 'num' || p.k === 'expr') && !p.fast && !p.sol?.length) add('E309', at('sol'), 'у num/expr без fast нет sol');

  // E310: цель и out виджета
  if ((p.k === 'graph' || p.k === 'sim') && p.w && p.goal) {
    const mod = ctx.modules[p.w.w];
    const sl = Object.keys(p.w.sl ?? {});
    const outs = mod ? [...mod.meta.out, ...mod.controls(p.w, {}).map((c) => c.name)] : [...(ctx.widgetDoc[p.w.w] ?? []), ...sl];
    for (const name of Object.keys(p.goal)) if (!outs.includes(name) && !(p.w.drag && name.includes('.'))) add('E310', at('goal.' + name), `переменной нет в out виджета ${p.w.w}`);
  }

  // прогон генераторов: seed 1…SEEDS
  const seen = {};
  const report = (code, msg) => {
    if (!seen[code]) {
      seen[code] = true;
      add(code, at(), msg);
    }
  };
  let tries = 0;
  let ok = 0;
  let collide = 0;
  let sample;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let inst;
    try {
      inst = instantiate(p, seed, { lesson: L });
    } catch (e) {
      const m = String(e.message);
      if (/Undefined (symbol|function)/i.test(m)) report('E301', `неопределённая переменная при seed=${seed}: ${m}`);
      else if (/ограничения c/.test(m)) report('E302', `ограничения c не выполняются (seed=${seed})`);
      else report('E303', `не вычислилось при seed=${seed}: ${m}`);
      continue;
    }
    ok++;
    sample ??= inst;
    tries += inst.tries;
    checkInstance(inst, seed, p, report, () => collide++, ctx.modules);
  }
  if (ok && tries / ok > 5) add('E302', at('c'), `ограничения c отбрасывают ${Math.round((1 - ok / tries) * 100)} % наборов`);
  if (collide) {
    const rate = collide / SEEDS;
    if (rate > 0.3) add('E304', at('e'), `диагностика совпала с верным ответом в ${Math.round(rate * 100)} % наборов`);
    else add('W508', at('e'), `диагностика совпала с верным ответом в ${Math.round(rate * 100)} % наборов`);
  }

  // достижимость цели graph (виджеты с модулем, без перетаскивания)
  if (p.k === 'graph' && ctx.modules[p.w?.w] && !p.w.drag) {
    for (let seed = 1; seed <= 40; seed++) {
      let inst;
      try {
        inst = instantiate(p, seed, { lesson: L });
      } catch {
        break;
      }
      if (!goalReachable(ctx.modules[p.w.w], p.w, inst.scope, inst.goal)) {
        add('E310', at('goal'), `цель недостижима при seed=${seed}`);
        break;
      }
    }
  }
}

/** E404: параметры виджета вычисляются при подстановке чисел задачи (проверяем виджеты в условии и в решении). */
function checkWidgets(inst, seed, p, report, modules) {
  const list = [...(inst.w ? [inst.w] : []), ...(p.sol ?? []).filter((s) => s && typeof s === 'object' && s.w)];
  for (const w of list) {
    const mod = modules[w.w];
    if (!mod) continue;
    try {
      mod.compute(w, inst.scope, mod.initial(w, inst.scope));
    } catch (e) {
      report('E404', `параметры виджета ${w.w} не вычисляются при seed=${seed}: ${String(e.message).slice(0, 80)}`);
    }
  }
}

function checkInstance(inst, seed, p, report, onCollide, modules = {}) {
  if (seed <= 20) checkWidgets(inst, seed, p, report, modules);
  // E305: формулы после подстановки
  const texts = [inst.q, ...inst.h, ...inst.sol.filter((s) => typeof s === 'string'), ...(inst.steps ?? []), ...(inst.options ?? []).map((o) => o.text)];
  if (seed <= 20) {
    for (const t of texts) {
      for (const m of mathParts(t)) {
        try {
          katex.renderToString(m, { throwOnError: true, strict: 'ignore' });
        } catch (e) {
          report('E305', `KaTeX не отрисовал формулу при seed=${seed}: $${m.slice(0, 40)}$`);
        }
      }
    }
  }
  if (seed <= 20) {
    for (const t of texts) {
      const plain = String(t).replace(/\$[^$]+\$/g, '');
      if (/\\/.test(plain)) report('E305', `TeX вне формулы при seed=${seed}: ${plain.slice(0, 60)}`);
    }
  }
  if (inst.k === 'num') {
    const input = (v) => (Array.isArray(v) ? v.map((r) => (Array.isArray(r) ? r.map(String) : String(r))) : String(v));
    if (!checkAnswer(inst, input(inst.a)).ok) report('E303', `верный ответ не принят при seed=${seed}`);
    for (const v of Object.values(inst.diag)) if (checkAnswer(inst, input(v)).ok) onCollide();
  } else if (inst.k === 'mc') {
    const t = inst.options.map((o) => o.text);
    if (new Set(t).size !== t.length) report('E304', `одинаковые варианты mc при seed=${seed}`);
    if (!inst.options.some((o) => o.ok)) report('E303', `нет верного варианта при seed=${seed}`);
  } else if (inst.k === 'expr') {
    const bad = freeSymbols(p.a, [...inst.vars, ...Object.keys(inst.scope)]);
    if (bad.length) return report('E308', `в ответе неизвестные имена: ${bad.join(', ')}`);
    if (!checkAnswer(inst, typed(inst)).ok) report('E308', `ответ не вычисляется на dom или не совпал с собой при seed=${seed}`);
    for (const ex of Object.values(inst.diag)) {
      const t = ex.replace(/\b[A-Za-z]\w*\b/g, (n) => (n in inst.scope ? '(' + inst.scope[n] + ')' : n));
      if (checkAnswer(inst, t).ok) onCollide();
    }
  } else if (inst.k === 'spot') {
    if (inst.badIndex < 1 || inst.badIndex > inst.steps.length) report('E303', `номер подменённого шага вне диапазона при seed=${seed}`);
  }
}

/** Проверка карты курса: предпосылки, циклы, приоритеты. */
export function lintCourse(index) {
  const res = [];
  const byId = Object.fromEntries(index.map((l) => [l.id, l]));
  for (const l of index) {
    for (const d of l.pre) {
      if (!byId[d]) res.push({ code: 'E201', id: l.id, path: 'pre', msg: `предпосылка не найдена: ${d}` });
      else if (l.p === 'core' && byId[d].p !== 'core') res.push({ code: 'E206', id: l.id, path: 'pre', msg: `урок ядра зависит от ${byId[d].p === 'ext' ? 'расширения' : 'опции'}: ${d}` });
      else if (l.p === 'ext' && byId[d].p === 'opt') res.push({ code: 'E206', id: l.id, path: 'pre', msg: `расширение зависит от опции: ${d}` });
    }
  }
  const state = {};
  const dfs = (u, path) => {
    if (state[u] === 1) {
      res.push({ code: 'E202', id: u, path: 'pre', msg: 'цикл: ' + [...path, u].join(' → ') });
      return;
    }
    if (state[u] === 2) return;
    state[u] = 1;
    for (const d of byId[u]?.pre ?? []) if (byId[d]) dfs(d, [...path, u]);
    state[u] = 2;
  };
  for (const l of index) dfs(l.id, []);
  return res;
}

/** Контекст линтера: справочники, реестр виджетов и их модули. */
export async function makeContext(root = process.cwd()) {
  const { data, errors } = loadContent(root);
  const widgetDoc = parseWidgetDoc(readFileSync(join(root, 'docs/WIDGETS.md'), 'utf8'));
  const ctx = { glossary: data.ref.glossary, errors: data.ref.errors, widgetDoc, modules: {}, rawLength: {} };
  await Promise.all(Object.entries(loaders).map(async ([n, l]) => (ctx.modules[n] = await l())));
  return { data, loadErrors: errors, ctx };
}

/** Полный прогон. @returns {Promise<{errors: string[], warnings: string[], lessons: number}>} строки «КОД файл путь — сообщение» */
export async function lintAll(root = process.cwd(), only = null) {
  const { data, loadErrors, ctx } = await makeContext(root);
  const errors = [...loadErrors];
  const warnings = [];
  const file = (id) => `content/lessons/${id.split('.')[0]}/${id}.yml`;
  for (const id of Object.keys(data.lessons)) ctx.rawLength[id] = readFileSync(join(root, file(id)), 'utf8').length;
  for (const id of Object.keys(data.lessons)) {
    if (only && !id.startsWith(only)) continue;
    const raw = readFileSync(join(root, file(id)), 'utf8');
    raw.split('\n').forEach((line, i) => {
      if (/"[^"\n]*\\[^"\n]*"/.test(line)) errors.push(`E105 ${file(id)}:${i + 1} — в двойных кавычках есть «\\»: используй одинарные`);
    });
    for (const r of lintLesson(data.lessons[id], data.cards[id], ctx)) {
      (r.code[0] === 'E' ? errors : warnings).push(`${r.code} ${file(id)} ${r.path} — ${r.msg}`);
    }
  }
  for (const r of lintCourse(data.index)) {
    if (only && !r.id.startsWith(only)) continue;
    errors.push(`${r.code} docs/COURSE_MAP.md ${r.id}.${r.path} — ${r.msg}`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], lessons: Object.keys(data.lessons).length };
}
