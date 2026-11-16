// Выгружает числовые задачи (num) всех уроков: 40 наборов на задачу, с переменными и ответом движка.
// Независимые Python-проверки tools/check/answers_*.py пересчитывают ответы перебором, численно или по формулам.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { instantiate } from '../engine/core/gen.js';

const out = [];
for (const dir of readdirSync('content/lessons')) {
  for (const f of readdirSync(`content/lessons/${dir}`)) {
    const L = load(readFileSync(`content/lessons/${dir}/${f}`, 'utf8'));
    for (const [pid, p] of Object.entries(L.pr)) {
      if (p.k !== 'num') continue;
      for (let seed = 1; seed <= 40; seed++) {
        try {
          const i = instantiate(p, seed, { lesson: L });
          out.push({ id: L.id, pid, seed, scope: i.scope, a: i.a, q: i.q });
        } catch {
          /* ошибки вычисления ловит линтер */
        }
      }
    }
  }
}
writeFileSync(process.argv[2] ?? '/tmp/math-answers.json', JSON.stringify(out));
console.log('выгружено наборов:', out.length);
