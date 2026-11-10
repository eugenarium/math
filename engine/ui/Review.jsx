import { useState, useMemo } from 'preact/hooks';
import { Problem } from './Problem.jsx';
import { Rich } from './Rich.jsx';
import { instantiate } from '../core/gen.js';
import { buildSession, grade, dayNumber, INTERVALS, TASKS_PER_LESSON } from '../core/srs.js';
import { recordProblem, recordMisconception } from '../core/store.js';

/** Сессия повторения: задачи разных уроков вперемешку, итог по каждому уроку. */
export function Review({ data, state, update, onExit }) {
  const today = dayNumber();
  const items = useMemo(() => buildSession(state.L, data.lessons, state.T, today, today * 7 + 3), []);
  const [i, setI] = useState(0);
  const [res, setRes] = useState({}); // id → верно
  const [summary, setSummary] = useState(null);

  const item = items[i];
  const lesson = item && data.lessons[item.id];
  const inst = useMemo(() => (item ? instantiate(lesson.pr[item.pid], item.seed, { lesson }) : null), [i]);

  const onDone = ({ ok, diags }) => {
    update((s) => {
      recordProblem(s, item.id, item.pid, ok);
      for (const d of diags) recordMisconception(s, d);
    });
    const next = { ...res, [item.id]: (res[item.id] ?? 0) + (ok ? 1 : 0) };
    setRes(next);
    if (i + 1 < items.length) return setI(i + 1);
    // конец сессии: оцениваем каждый урок
    const out = [];
    update((s) => {
      for (const id of Object.keys(next)) {
        const before = s.L[id];
        s.L[id] = grade(before, next[id], TASKS_PER_LESSON, today);
        out.push({ id, right: next[id], days: INTERVALS[s.L[id][1]], back: s.L[id][1] < before[1] });
      }
    });
    setSummary(out);
  };

  if (!items.length)
    return (
      <div class="lesson">
        <main class="screen">
          <p>На сегодня повторений нет.</p>
          <div class="bar">
            <button type="button" class="btn primary" onClick={onExit}>
              К списку
            </button>
          </div>
        </main>
      </div>
    );

  if (summary)
    return (
      <div class="lesson">
        <header class="topbar">
          <div class="title">
            <strong>Повторение завершено</strong>
          </div>
        </header>
        <main class="screen">
          {summary.map((r) => (
            <div class="card" key={r.id}>
              <h4>{data.cards[r.id].t}</h4>
              <p>
                Верно {r.right} из {TASKS_PER_LESSON}.{' '}
                {r.back ? `Вернём раньше: повторение через ${r.days} дн.` : `Следующее повторение через ${r.days} дн.`}
              </p>
              {r.right < TASKS_PER_LESSON - 1 && <Rich class="muted" text="Стоит пересмотреть разобранный пример этого урока." />}
            </div>
          ))}
          <div class="bar">
            <button type="button" class="btn primary" onClick={onExit}>
              К списку
            </button>
          </div>
        </main>
      </div>
    );

  return (
    <div class="lesson">
      <header class="topbar">
        <button type="button" class="back" onClick={onExit} aria-label="Прервать повторение">
          ←
        </button>
        <div class="title">
          <strong>Повторение</strong>
          <span class="muted">{data.cards[item.id].t}</span>
        </div>
      </header>
      <div class="progress">
        <div style={{ width: `${(i / items.length) * 100}%` }} />
      </div>
      <main class="screen">
        <p class="muted counter">
          Задача {i + 1} из {items.length}. Одна попытка, без подсказок.
        </p>
        <Problem key={i} inst={inst} refs={data.ref} exam onDone={onDone} />
      </main>
    </div>
  );
}
