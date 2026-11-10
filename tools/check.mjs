// npm run check [id|раздел] — линтер контента. Код возврата ≠ 0 при любой ошибке E; предупреждения W не блокируют.
import { lintAll } from './lint.mjs';

const only = process.argv[2] ?? null;
const { errors, warnings, lessons } = await lintAll(process.cwd(), only);
for (const w of warnings) console.log(w);
for (const e of errors) console.error(e);
console.log(`уроков: ${lessons}, ошибок: ${errors.length}, предупреждений: ${warnings.length}`);
process.exit(errors.length ? 1 : 0);
