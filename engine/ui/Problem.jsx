import { useState, useMemo } from 'preact/hooks';
import { Rich } from './Rich.jsx';
import { Widget, SolStep } from './Widget.jsx';
import { Keypad, NUM_KEYS, exprKeys, applyKey } from './Keypad.jsx';
import { checkAnswer } from '../core/check.js';
import { toTex } from '../core/mathx.js';
import { tex } from '../core/md.js';

/** Форма ответа num: скаляр, столбец или матрица → [строки, столбцы]. */
function shapeOf(a) {
  if (!Array.isArray(a)) return [1, 1];
  if (!Array.isArray(a[0])) return [a.length, 1];
  return [a.length, a[0].length];
}

function reshape(fields, [r, c], scalar, vector) {
  if (scalar) return fields[0];
  if (vector) return fields;
  return Array.from({ length: r }, (_, i) => fields.slice(i * c, (i + 1) * c));
}

function exprPreview(s) {
  try {
    const norm = s.replace(/−/g, '-').replace(/π/g, 'pi').replace(/√\(/g, 'sqrt(').replace(/\*/g, ' * ');
    return norm.trim() ? tex(toTex(norm)) : '';
  } catch {
    return '';
  }
}

function ErrorCard({ e }) {
  return (
    <div class="card err-card">
      <h4>{e.t}</h4>
      <Rich text={'**Как ошибаются.** ' + e.bad} />
      <Rich text={'**Почему неверно.** ' + e.why} />
      <Rich text={'**Как правильно.** ' + e.fix} />
    </div>
  );
}

/**
 * Одна задача. По окончании вызывает onDone({ok, diags}):
 * ok — верно с первой попытки и без подсказок.
 */
export function Problem({ inst, refs, onDone, exam = false }) {
  if (import.meta.env.DEV) window.__inst = inst; // для e2e-проверок
  const [shape, scalar, vector] = useMemo(() => {
    if (inst.k !== 'num') return [[1, 1], true, false];
    const s = shapeOf(inst.a);
    return [s, !Array.isArray(inst.a), Array.isArray(inst.a) && !Array.isArray(inst.a[0])];
  }, [inst]);
  const nFields = shape[0] * shape[1];

  const [fields, setFields] = useState(Array(nFields).fill(''));
  const [active, setActive] = useState(0);
  const [expr, setExpr] = useState('');
  const [picked, setPicked] = useState([]);
  const [line, setLine] = useState(0);
  const [seq, setSeq] = useState([]); // proof/ord: индексы показанных шагов в выбранном порядке
  const [picks, setPicks] = useState(() => (inst.k === 'proof' && inst.mode === 'why' ? inst.steps.map(() => null) : []));
  const [activeStep, setActiveStep] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [hints, setHints] = useState(0);
  const [msg, setMsg] = useState(null); // {kind, text?, diag?}
  const [done, setDone] = useState(null); // 'ok' | 'fail'
  const [diags, setDiags] = useState([]);
  const [wstate, setWstate] = useState(null);
  const maxAttempts = exam ? 1 : inst.k === 'graph' || inst.k === 'sim' ? 4 : 2;

  const locked = done !== null;

  const input = () => {
    if (inst.k === 'num') return reshape(fields, shape, scalar, vector);
    if (inst.k === 'expr') return expr;
    if (inst.k === 'mc') return picked;
    if (inst.k === 'spot') return line;
    if (inst.k === 'proof') return inst.mode === 'why' ? picks : seq;
    if (inst.k === 'graph') return wstate;
    if (inst.k === 'sim') return { runs: wstate?.runs ?? 0, state: wstate, answer: fields[0] };
    return null;
  };

  const ready = () => {
    if (inst.k === 'num') return fields.every((f) => f.trim() !== '');
    if (inst.k === 'expr') return expr.trim() !== '';
    if (inst.k === 'mc') return picked.length > 0;
    if (inst.k === 'spot') return line > 0;
    if (inst.k === 'proof') return inst.mode === 'why' ? picks.every((x) => x !== null) : seq.length === inst.steps.length;
    if (inst.k === 'graph') return wstate !== null;
    if (inst.k === 'sim') return wstate !== null && (inst.a === undefined || fields[0].trim() !== '');
    return false;
  };

  const check = () => {
    const res = checkAnswer(inst, input());
    if (res.error) return setMsg({ kind: 'input', text: res.error });
    if (res.ok) {
      setMsg({ kind: 'ok' });
      return setDone(attempts === 0 && hints === 0 ? 'ok' : 'fail-ok');
    }
    const nd = res.diag ? [...diags, res.diag] : diags;
    setDiags(nd);
    const n = attempts + 1;
    setAttempts(n);
    if (n >= maxAttempts) {
      setMsg({ kind: 'bad', diag: res.diag });
      return setDone('fail');
    }
    setMsg({ kind: 'bad', diag: res.diag, hint: res.diag ? null : inst.h[Math.min(n, inst.h.length) - 1] });
    if (!res.diag && inst.h.length) setHints(Math.max(hints, Math.min(n, inst.h.length)));
  };

  const key = (k) => {
    if (locked) return;
    if (inst.k === 'num' || inst.k === 'sim') setFields(fields.map((f, i) => (i === active ? applyKey(f, k) : f)));
    else if (inst.k === 'expr') setExpr(applyKey(expr, k));
  };

  const togglePick = (i) => {
    if (locked) return;
    if (inst.multi) setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]);
    else setPicked([i]);
  };

  const hint = () => {
    const n = Math.min(inst.h.length, hints + 1);
    setHints(n);
    setMsg({ kind: 'hint', text: inst.h[n - 1] });
  };

  const finish = () => onDone({ ok: done === 'ok', diags });

  return (
    <div class="problem">
      <Rich text={inst.q || (inst.k === 'spot' ? 'Найди ошибку. Коснись строки с ошибкой.' : '')} class="q" />

      {(inst.k === 'graph' || inst.k === 'sim') && (
        <div class="card">
          <Widget params={inst.w} scope={inst.scope} onState={setWstate} />
        </div>
      )}

      {inst.k === 'sim' && <p class="muted">Опытов: {wstate?.runs ?? 0} из {inst.min}.</p>}

      {(inst.k === 'num' || (inst.k === 'sim' && inst.a !== undefined)) && (
        <div class="answer">
          <div class="fields" style={{ gridTemplateColumns: `repeat(${shape[1]}, minmax(0, 7.5rem))` }}>
            {fields.map((f, i) => (
              <button
                key={i}
                type="button"
                class={'field' + (i === active ? ' active' : '')}
                onClick={() => setActive(i)}
                aria-label={`поле ${i + 1}`}
              >
                {f || ' '}
              </button>
            ))}
            {inst.unit && <span class="unit">{inst.unit}</span>}
          </div>
          {!locked && <Keypad keys={NUM_KEYS} onKey={key} />}
        </div>
      )}

      {inst.k === 'expr' && (
        <div class="answer">
          <div class="field expr-field">{expr || ' '}</div>
          <div class="preview" dangerouslySetInnerHTML={{ __html: exprPreview(expr) }} />
          {!locked && <Keypad keys={exprKeys(inst.vars)} onKey={key} cols={5} />}
        </div>
      )}

      {inst.k === 'mc' && (
        <div class="options">
          {inst.options.map((o, i) => (
            <button
              key={i}
              type="button"
              class={'option' + (picked.includes(i) ? ' picked' : '') + (locked && o.ok ? ' right' : '')}
              onClick={() => togglePick(i)}
              aria-pressed={picked.includes(i)}
            >
              <Rich text={o.text} as="span" />
            </button>
          ))}
          {inst.multi && <p class="muted">Верных вариантов несколько.</p>}
        </div>
      )}

      {inst.k === 'spot' && (
        <ol class="steps spot">
          {inst.steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                class={'step' + (line === i + 1 ? ' picked' : '') + (locked && inst.badIndex === i + 1 ? ' right' : '')}
                onClick={() => !locked && setLine(i + 1)}
              >
                <Rich text={s} as="span" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {inst.k === 'proof' && inst.mode !== 'why' && (
        <div class="proof">
          <p class="muted">Коснись шагов по порядку. Коснись выбранного шага, чтобы убрать его.</p>
          <ol class="steps proof-seq">
            {seq.map((s, pos) => (
              <li key={s}>
                <button type="button" class="step picked" onClick={() => !locked && setSeq(seq.filter((x) => x !== s))}>
                  <Rich text={inst.steps[s]} as="span" />
                </button>
              </li>
            ))}
          </ol>
          <ul class="steps proof-rest">
            {inst.steps.map((s, i) =>
              seq.includes(i) ? null : (
                <li key={i}>
                  <button type="button" class="step" onClick={() => !locked && setSeq([...seq, i])}>
                    <Rich text={s} as="span" />
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {inst.k === 'proof' && inst.mode === 'why' && (
        <div class="proof">
          <p class="muted">Выбери шаг, затем его обоснование.</p>
          <ol class="steps">
            {inst.steps.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  class={'step' + (activeStep === i ? ' picked' : '') + (locked && picks[i] === inst.key[i] ? ' right' : '')}
                  onClick={() => setActiveStep(i)}
                >
                  <Rich text={s} as="span" />
                  <span class="because">{picks[i] === null ? 'обоснование не выбрано' : null}</span>
                  {picks[i] !== null && <Rich text={'Обоснование: ' + inst.pool[picks[i]]} as="span" class="because" />}
                </button>
              </li>
            ))}
          </ol>
          {!locked && (
            <ul class="steps proof-rest">
              {inst.pool.map((t, j) => (
                <li key={j}>
                  <button
                    type="button"
                    class="step"
                    onClick={() => {
                      setPicks(picks.map((x, i) => (i === activeStep ? j : x)));
                      if (activeStep < inst.steps.length - 1) setActiveStep(activeStep + 1);
                    }}
                  >
                    <Rich text={t} as="span" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {done && done !== 'ok' && inst.k === 'proof' && (
        <div class="card sol">
          <h4>Верный вариант</h4>
          <ol>
            {inst.mode === 'why'
              ? inst.steps.map((s, i) => (
                  <li key={i}>
                    <Rich text={s + ' — ' + inst.pool[inst.key[i]]} as="span" />
                  </li>
                ))
              : inst.steps
                  .map((s, i) => ({ s, o: inst.order[i] }))
                  .sort((a, b) => a.o - b.o)
                  .map(({ s }, i) => (
                    <li key={i}>
                      <Rich text={s} as="span" />
                    </li>
                  ))}
          </ol>
        </div>
      )}

      {msg?.kind === 'ok' && <p class="feedback ok">Верно.</p>}
      {msg?.kind === 'input' && <p class="feedback warn">{msg.text}</p>}
      {msg?.kind === 'bad' && (
        <div class="feedback bad">
          <p>Неверно.</p>
          {msg.diag && refs.errors[msg.diag] && <ErrorCard e={refs.errors[msg.diag]} />}
          {msg.hint && <Rich text={'Подсказка. ' + msg.hint} />}
        </div>
      )}
      {msg?.kind === 'hint' && <Rich class="feedback hint" text={'Подсказка. ' + msg.text} />}

      {done && done !== 'ok' && inst.sol.length > 0 && (
        <div class="card sol">
          <h4>Решение</h4>
          <ol>
            {inst.sol.map((s, i) => (
              <li key={i}>
                <SolStep s={s} scope={inst.scope} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {done && inst.k === 'spot' && inst.diagId && refs.errors[inst.diagId] && <ErrorCard e={refs.errors[inst.diagId]} />}

      <div class="bar">
        {!exam && !locked && inst.h.length > hints && (
          <button type="button" class="btn ghost" onClick={hint}>
            Подсказка
          </button>
        )}
        {!locked ? (
          <button type="button" class="btn primary" disabled={!ready()} onClick={check}>
            Проверить
          </button>
        ) : (
          <button type="button" class="btn primary" onClick={finish}>
            Дальше
          </button>
        )}
      </div>
    </div>
  );
}
