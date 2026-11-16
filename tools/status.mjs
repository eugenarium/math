// Состояние курса: что готово по карте, что не сделано, какие виджеты реализованы.
// Таблицы строятся из docs/COURSE_MAP.md, content/lessons и engine/widgets/index.js.
//   node tools/status.mjs            — вывести таблицы
//   node tools/status.mjs --write    — обновить блок между маркерами в docs/STATUS.md
//   node tools/status.mjs --check    — завершиться с ошибкой, если docs/STATUS.md устарел (запускается в CI)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const BEGIN = '<!-- status:begin -->';
const END = '<!-- status:end -->';
const PRIORITY = { Я: 'ядро', Р: 'расширение', О: 'опция' };

export function parseMap(text) {
  /** @type {{id: string, sec: string, secName: string, title: string, p: string, min: number, tags: string}[]} */
  const rows = [];
  let sec = null;
  for (const line of text.split('\n')) {
    const h = /^## ([a-z0-9]+) · (.*)$/.exec(line);
    if (h) {
      sec = { id: h[1], name: h[2] };
      continue;
    }
    const m = /^\| ([a-z0-9]+\.[a-z0-9]+) \| (.*?) \| (.*?) \| ([ЯРО]) \| (\d+) \|(.*)\|$/.exec(line);
    if (m && sec) rows.push({ id: m[1], sec: sec.id, secName: sec.name, title: m[2], p: m[4], min: Number(m[5]), tags: m[6].trim() });
  }
  return rows;
}

function lessonIds() {
  const ids = new Set();
  for (const dir of readdirSync('content/lessons')) for (const f of readdirSync(`content/lessons/${dir}`)) if (f.endsWith('.yml')) ids.add(f.slice(0, -4));
  return ids;
}

function implementedWidgets() {
  const src = readFileSync('engine/widgets/index.js', 'utf8');
  const body = /loaders\s*=\s*\{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
  return new Set([...body.matchAll(/^\s*([a-z0-9]+)\s*:/gm)].map((m) => m[1]));
}

function catalogWidgets() {
  const text = readFileSync('docs/WIDGETS.md', 'utf8');
  const out = new Map();
  for (const m of text.matchAll(/^\| ([a-z0-9]+) \| (P0|P1|P2|3D) \|/gm)) out.set(m[1], m[2]);
  return out;
}

export function buildStatus() {
  const rows = parseMap(readFileSync('docs/COURSE_MAP.md', 'utf8'));
  const have = lessonIds();
  const impl = implementedWidgets();
  const catalog = catalogWidgets();
  const bySec = new Map();
  for (const r of rows) {
    if (!bySec.has(r.sec)) bySec.set(r.sec, { name: r.secName, rows: [] });
    bySec.get(r.sec).rows.push(r);
  }
  const lines = [];
  lines.push('### Готовность по разделам', '');
  lines.push('| Раздел | Название | Уроков в карте (ядро / расш. / опция) | Готово (ядро / расш. / опция) | Минут готово из всех |');
  lines.push('|---|---|---|---|---|');
  const tot = { all: 0, done: 0, Я: 0, Р: 0, О: 0, dЯ: 0, dР: 0, dО: 0, min: 0, minAll: 0 };
  for (const [id, s] of bySec) {
    const c = { Я: 0, Р: 0, О: 0, dЯ: 0, dР: 0, dО: 0, min: 0, minAll: 0 };
    for (const r of s.rows) {
      c[r.p]++;
      c.minAll += r.min;
      if (have.has(r.id)) {
        c['d' + r.p]++;
        c.min += r.min;
      }
    }
    for (const k of Object.keys(c)) tot[k] += c[k];
    tot.all += s.rows.length;
    tot.done += c.dЯ + c.dР + c.dО;
    lines.push(`| \`${id}\` | ${s.name} | ${s.rows.length} (${c.Я} / ${c.Р} / ${c.О}) | ${c.dЯ + c.dР + c.dО} (${c.dЯ} / ${c.dР} / ${c.dО}) | ${c.min} из ${c.minAll} |`);
  }
  lines.push(`| | **Итого** | **${tot.all}** (${tot.Я} / ${tot.Р} / ${tot.О}) | **${tot.done}** (${tot.dЯ} / ${tot.dР} / ${tot.dО}) | **${tot.min} из ${tot.minAll}** |`);
  const extra = [...have].filter((id) => !rows.some((r) => r.id === id));
  if (extra.length) lines.push('', `Файлы уроков вне карты: ${extra.map((x) => `\`${x}\``).join(', ')}.`);

  lines.push('', '### Не сделано: уроки ядра', '');
  for (const [id, s] of bySec) {
    const left = s.rows.filter((r) => r.p === 'Я' && !have.has(r.id));
    const hasCore = s.rows.some((r) => r.p === 'Я');
    lines.push(`- \`${id}\`: ${left.length ? left.map((r) => `\`${r.id}\``).join(', ') : hasCore ? 'всё ядро готово' : 'в разделе нет уроков ядра'}`);
  }
  lines.push('', '### Не сделано: расширения и опции, по разделам', '');
  for (const [id, s] of bySec) {
    const left = s.rows.filter((r) => r.p !== 'Я' && !have.has(r.id));
    if (left.length) lines.push(`- \`${id}\`: ${left.map((r) => `\`${r.id}\`${r.p === 'О' ? ' (опция)' : ''}`).join(', ')}`);
  }

  lines.push('', '### Виджеты', '');
  const implList = [...impl].sort();
  lines.push(`Реализовано ${implList.length} из ${catalog.size} виджетов каталога: ${implList.map((w) => `\`${w}\``).join(', ')}.`);
  const missing = [...catalog].filter(([w]) => !impl.has(w));
  const byPrio = (p) => missing.filter(([, q]) => q === p).map(([w]) => `\`${w}\``).join(', ');
  lines.push('', `Не реализовано: P0 — ${byPrio('P0') || 'нет'}; P1 — ${byPrio('P1') || 'нет'}; P2 — ${byPrio('P2') || 'нет'}; 3D — ${byPrio('3D') || 'нет'}.`);
  const starMissing = [];
  for (const r of rows) {
    if (!have.has(r.id)) continue;
    for (const m of r.tags.matchAll(/★ ([a-z0-9]+)/g)) if (catalog.has(m[1]) && !impl.has(m[1])) starMissing.push(`\`${r.id}\` → \`${m[1]}\``);
  }
  lines.push('', `Готовые уроки, у которых карта предусматривает ★-виджет, но его ещё нет (урок написан без него): ${starMissing.length ? starMissing.join(', ') : 'нет'}.`);
  return lines.join('\n');
}

const mode = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  const table = buildStatus();
  if (!mode) console.log(table);
  else {
    const file = 'docs/STATUS.md';
    if (!existsSync(file)) throw new Error('нет docs/STATUS.md');
    const text = readFileSync(file, 'utf8');
    const i = text.indexOf(BEGIN);
    const j = text.indexOf(END);
    if (i < 0 || j < i) throw new Error('в docs/STATUS.md нет маркеров ' + BEGIN + ' и ' + END);
    const next = text.slice(0, i + BEGIN.length) + '\n\n' + table + '\n\n' + text.slice(j);
    if (mode === '--write') {
      writeFileSync(file, next);
      console.log('docs/STATUS.md обновлён');
    } else if (mode === '--check') {
      if (next !== text) {
        console.error('docs/STATUS.md устарел: запусти `node tools/status.mjs --write`');
        process.exit(1);
      }
      console.log('docs/STATUS.md актуален');
    }
  }
}
