// Компиляция контента: YAML → JSON с проверкой по схемам.
// Используется плагином Vite (virtual:content) и скриптом `npm run check`.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';

const yml = (p) => load(readFileSync(p, 'utf8'));

/** Разбор docs/COURSE_MAP.md: разделы и уроки с предпосылками (↑ раскрыт). */
export function parseCourseMap(text) {
  const sections = {};
  const lessons = [];
  let prev = null;
  for (const line of text.split('\n')) {
    const s = /^\| ([a-z0-9]+) \| ([^|]+) \| ([^|]+) \| ([\d/]+) \|/.exec(line);
    if (s && !/^\|\s*Код/.test(line)) sections[s[1]] = s[2].trim();
    const m = /^\| ([a-z0-9]+\.[a-z0-9]+) \| (.*?) \| (.*?) \| (Я|Р|О) \| (\d+) \|/.exec(line);
    if (!m) continue;
    const [, id, title, deps, pr, min] = m;
    const sec = id.split('.')[0];
    const pre = [];
    for (const d of deps.split(',').map((x) => x.trim())) {
      if (d === '↑') {
        if (prev && prev.split('.')[0] === sec) pre.push(prev);
      } else if (d !== '—' && d) pre.push(d);
    }
    lessons.push({
      id,
      sec,
      t: title.replace(/\s*[★⚠]\s*(виджет|3D)?/g, '').replace(/\s+3D\b/g, '').trim(),
      pre,
      p: { Я: 'core', Р: 'ext', О: 'opt' }[pr],
      min: Number(min),
    });
    prev = id;
  }
  return { sections, lessons };
}

function makeValidators(root) {
  const ajv = new Ajv2020({ strict: false, allErrors: false });
  ajv.addSchema(yml(join(root, 'schema/problem.schema')));
  ajv.addSchema(yml(join(root, 'schema/lesson.schema')));
  return {
    lesson: ajv.getSchema('lesson.schema'),
    cards: ajv.getSchema('lesson.schema#/$defs/cards'),
  };
}

const fmtErr = (v) => (v.errors ?? []).slice(0, 3).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');

/** @returns {{data: any, errors: string[]}} */
export function loadContent(root = process.cwd()) {
  const errors = [];
  const V = makeValidators(root);
  const map = parseCourseMap(readFileSync(join(root, 'docs/COURSE_MAP.md'), 'utf8'));

  const cards = {};
  const cdir = join(root, 'content/cards');
  if (existsSync(cdir)) {
    for (const f of readdirSync(cdir).filter((x) => x.endsWith('.yml'))) {
      const c = yml(join(cdir, f));
      if (!V.cards(c)) errors.push(`E102 content/cards/${f} — ${fmtErr(V.cards)}`);
      Object.assign(cards, c);
    }
  }

  const lessons = {};
  const ldir = join(root, 'content/lessons');
  if (existsSync(ldir)) {
    for (const sec of readdirSync(ldir)) {
      for (const f of readdirSync(join(ldir, sec)).filter((x) => x.endsWith('.yml'))) {
        const path = `content/lessons/${sec}/${f}`;
        const L = yml(join(root, path));
        if (L.id !== f.replace(/\.yml$/, '') || !cards[L.id]) errors.push(`E103 ${path} — id не совпадает с именем файла или нет карточки`);
        if (!V.lesson(L)) errors.push(`E102 ${path} — ${fmtErr(V.lesson)}`);
        lessons[L.id] = L;
      }
    }
  }

  const ref = {
    glossary: yml(join(root, 'content/ref/glossary.yml')),
    errors: yml(join(root, 'content/ref/errors.yml')),
  };

  const index = map.lessons.map((l) => {
    const c = cards[l.id];
    return { ...l, t: c?.t ?? l.t, pre: c?.pre ?? l.pre, has: !!lessons[l.id] };
  });
  for (const id of Object.keys(lessons)) {
    if (!map.lessons.some((l) => l.id === id)) errors.push(`E103 ${id} — нет в карте курса`);
  }
  for (const L of Object.values(lessons)) {
    for (const e of L.err ?? []) if (!ref.errors[e]) errors.push(`E204 ${L.id} err — нет в errors.yml: ${e}`);
    JSON.stringify(L, (k, v) => {
      if (k === 'g' && typeof v === 'string' && !ref.glossary[v]) errors.push(`E203 ${L.id} — нет в глоссарии: ${v}`);
      return v;
    });
  }

  return { data: { sections: map.sections, index, cards, lessons, ref }, errors };
}

// npm run check:content — вывод ошибок и код возврата
if (import.meta.url === `file://${process.argv[1]}`) {
  const { data, errors } = loadContent();
  for (const e of errors) console.error(e);
  console.log(`уроков: ${Object.keys(data.lessons).length}, карточек: ${Object.keys(data.cards).length}, тем в карте: ${data.index.length}`);
  process.exit(errors.length ? 1 : 0);
}
