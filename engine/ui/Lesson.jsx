import { useState, useMemo, useEffect } from 'preact/hooks';
import { Rich } from './Rich.jsx';
import { Problem } from './Problem.jsx';
import { instantiate } from '../core/gen.js';
import { isMastered, isStuck, pickNext, playableIds, MAX_TASKS } from '../core/mastery.js';
import { recordProblem, recordMisconception, setLessonStatus, LESSON_STARTED, LESSON_DONE, LESSON_RETURN } from '../core/store.js';

function Glossary({ g, refs }) {
  const e = refs.glossary[g];
  if (!e) return null;
  return (
    <div class="card gloss">
      <h3>{e.t}</h3>
      <Rich text={e.d} />
      {e.sym && <Rich class="muted" text={e.sym} />}
    </div>
  );
}

/** Разобранный пример: условие и шаги решения, открываются по одному. */
function Example({ x, seed, lesson }) {
  const p = lesson.pr[x];
  const inst = useMemo(() => instantiate(p, seed ?? 1, { lesson }), [x, seed]);
  const [open, setOpen] = useState(1);
  const steps = inst.sol;
  return (
    <div class="card example">
      <h3>Разбор</h3>
      <Rich text={inst.q} class="q" />
      <ol>
        {steps.slice(0, open).map((s, i) => (
          <li key={i}>
            <Rich text={s} as="span" />
          </li>
        ))}
      </ol>
      {open < steps.length ? (
        <button type="button" class="btn ghost" onClick={() => setOpen(open + 1)}>
          Следующий шаг
        </button>
      ) : (
        inst.a !== undefined && !Array.isArray(inst.a) && <p class="muted">Готово.</p>
      )}
    </div>
  );
}

function Prediction({ ask, ans }) {
  const [shown, setShown] = useState(false);
  return (
    <div class="card predict">
      <Rich text={ask} class="q" />
      {shown ? (
        <Rich text={ans} class="ans" />
      ) : (
        <button type="button" class="btn ghost" onClick={() => setShown(true)}>
          Показать ответ
        </button>
      )}
    </div>
  );
}

/** Виджеты появятся на следующих шагах плана; пока показываем задание. */
function WidgetStub({ s }) {
  return (
    <div class="card widget-stub">
      <p class="muted">Виджет «{s.w}» в разработке.</p>
      {s.cap && <Rich text={s.cap} />}
      {s.ask && <Prediction ask={s.ask} ans={s.ans} />}
    </div>
  );
}

function Screen({ s, lesson, refs }) {
  if (typeof s === 'string') return <Rich text={s} class="text" />;
  if (s.g) return <Glossary g={s.g} refs={refs} />;
  if (s.x) return <Example x={s.x} seed={s.seed} lesson={lesson} />;
  if (s.w) return <WidgetStub s={s} />;
  if (s.ask) return <Prediction ask={s.ask} ans={s.ans} />;
  return null;
}

const PHASES = [
  ['int', 'Интуиция'],
  ['def', 'Определение'],
  ['ex', 'Пример'],
  ['pr', 'Практика'],
  ['err', 'Ошибки'],
  ['sum', 'Итог'],
];

export function Lesson({ id, data, state, update, onExit }) {
  const lesson = data.lessons[id];
  const card = data.cards[id];
  const refs = data.ref;

  // линейный список экранов до практики
  const pre = useMemo(() => [...lesson.int.map((s) => ['int', s]), ...lesson.def.map((s) => ['def', s]), ...lesson.ex.map((s) => ['ex', s])], [id]);
  const [phase, setPhase] = useState('pre'); // pre | pr | err | sum
  const [i, setI] = useState(0);
  const [hist, setHist] = useState([]);
  const [salt] = useState(() => 1 + Math.floor(Math.random() * 900));
  const [taskKey, setTaskKey] = useState(0);
  const [diagSeen, setDiagSeen] = useState({});
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    update((s) => {
      if (s.L[id]?.[0] !== LESSON_DONE) setLessonStatus(s, id, LESSON_STARTED);
      s.cur = { id };
    });
    window.scrollTo(0, 0);
  }, [id]);

  const nextTask = useMemo(() => pickNext(hist, lesson.pr, salt), [hist.length, salt]);
  const inst = useMemo(() => {
    if (phase !== 'pr') return null;
    try {
      return instantiate(lesson.pr[nextTask.pid], nextTask.seed, { lesson });
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [phase, nextTask.pid, nextTask.seed, taskKey]);

  const progress = (() => {
    if (phase === 'pre') return (i + 1) / (pre.length + 4);
    if (phase === 'pr') return (pre.length + Math.min(hist.length, 8) / 8) / (pre.length + 4);
    if (phase === 'err') return (pre.length + 2) / (pre.length + 4);
    return (pre.length + 3.5) / (pre.length + 4);
  })();

  const label = phase === 'pre' ? PHASES.find((p) => p[0] === pre[i][0])[1] : PHASES.find((p) => p[0] === phase)[1];

  const onProblemDone = ({ ok, diags }) => {
    const h = [...hist, { pid: nextTask.pid, ok }];
    update((s) => {
      recordProblem(s, id, nextTask.pid, ok);
      for (const d of diags) recordMisconception(s, d);
    });
    if (diags.length) {
      setDiagSeen((prev) => {
        const next = { ...prev };
        for (const d of diags) next[d] = (next[d] ?? 0) + 1;
        return next;
      });
    }
    setHist(h);
    if (isMastered(h, lesson.pr)) return setPhase('err');
    if (isStuck(h, lesson.pr)) {
      setStuck(true);
      update((s) => setLessonStatus(s, id, LESSON_RETURN));
      return setPhase('err');
    }
    setTaskKey((k) => k + 1);
  };

  const finish = () => {
    update((s) => setLessonStatus(s, id, stuck ? LESSON_RETURN : LESSON_DONE));
    onExit();
  };

  // ошибки, которые ученик допустил, идут первыми
  const errOrder = [...lesson.err].sort((a, b) => (diagSeen[b] ?? 0) - (diagSeen[a] ?? 0));

  return (
    <div class="lesson">
      <header class="topbar">
        <button type="button" class="back" onClick={onExit} aria-label="К списку уроков">
          ←
        </button>
        <div class="title">
          <strong>{card.t}</strong>
          <span class="muted">{label}</span>
        </div>
      </header>
      <div class="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
        <div style={{ width: `${progress * 100}%` }} />
      </div>

      <main class="screen">
        {phase === 'pre' && (
          <>
            <Screen key={i} s={pre[i][1]} lesson={lesson} refs={refs} />
            <div class="bar">
              {i > 0 && (
                <button type="button" class="btn ghost" onClick={() => setI(i - 1)}>
                  Назад
                </button>
              )}
              <button type="button" class="btn primary" onClick={() => (i + 1 < pre.length ? setI(i + 1) : setPhase('pr'))}>
                Далее
              </button>
            </div>
          </>
        )}

        {phase === 'pr' &&
          (inst ? (
            <>
              <p class="muted counter">
                Задача {hist.length + 1} · уровень {inst.lv}
                {hist.length >= 5 ? ` · из последних 5 верно: ${hist.slice(-5).filter((h) => h.ok).length}` : ''}
              </p>
              <Problem key={`${nextTask.pid}-${nextTask.seed}-${taskKey}`} inst={inst} refs={refs} onDone={onProblemDone} />
            </>
          ) : (
            <p class="feedback warn">Не удалось построить задачу. Это ошибка в уроке.</p>
          ))}

        {phase === 'err' && (
          <>
            {stuck && (
              <p class="feedback warn">
                За {MAX_TASKS} задач критерий не выполнен. Урок отмечен «вернуться завтра». Перечитай пример и разбор ошибок.
              </p>
            )}
            <h3>Типичные ошибки</h3>
            {errOrder.map((e) => {
              const r = refs.errors[e];
              return (
                r && (
                  <div class={'card err-card' + (diagSeen[e] ? ' mine' : '')} key={e}>
                    <h4>
                      {r.t}
                      {diagSeen[e] ? <span class="badge">ты так ошибся</span> : null}
                    </h4>
                    <Rich text={'**Как ошибаются.** ' + r.bad} />
                    <Rich text={'**Почему неверно.** ' + r.why} />
                    <Rich text={'**Как правильно.** ' + r.fix} />
                  </div>
                )
              );
            })}
            <div class="bar">
              <button type="button" class="btn primary" onClick={() => setPhase('sum')}>
                Далее
              </button>
            </div>
          </>
        )}

        {phase === 'sum' && (
          <>
            <h3>Итог</h3>
            <ul class="summary">
              {lesson.sum.map((s, k) => (
                <li key={k}>
                  <Rich text={s} as="span" />
                </li>
              ))}
            </ul>
            <div class="bar">
              <button type="button" class="btn primary" onClick={finish}>
                {stuck ? 'К списку уроков' : 'Завершить урок'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
