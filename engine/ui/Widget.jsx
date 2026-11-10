import { useState, useEffect, useRef } from 'preact/hooks';
import { loaders } from '../widgets/index.js';
import { fmtNum } from '../core/gen.js';
import { Rich } from './Rich.jsx';

/** Шаг решения: текст или виджет (например, {w: matrix, M: A, op: char} — шаги строит движок). */
export function SolStep({ s, scope }) {
  if (typeof s === 'string') return <Rich text={s} as="span" />;
  return <Widget params={s} scope={scope} />;
}

/**
 * Хост виджета: загружает модуль, рисует слайдеры и переключатели, держит состояние.
 * onState(out) вызывается при каждом изменении состояния (для проверки цели goal).
 */
export function Widget({ params, scope = {}, onState }) {
  const [mod, setMod] = useState(null);
  const [vars, setVars] = useState(null);
  const [fail, setFail] = useState(false);
  const host = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    let dead = false;
    const load = loaders[params.w];
    if (!load) return setFail(true);
    load()
      .then((m) => {
        if (dead) return;
        setMod(m);
        setVars(m.initial(params, scope));
      })
      .catch(() => !dead && setFail(true));
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    if (!mod || !host.current) return;
    inst.current = mod.mount(host.current, { params, scope }, { onChange: (patch) => setVars((v) => ({ ...v, ...patch })) });
    inst.current.update({});
    return () => inst.current?.destroy();
  }, [mod]);

  useEffect(() => {
    if (!mod || !vars) return;
    inst.current?.update(vars);
    try {
      onState?.(mod.compute(params, scope, vars));
    } catch {
      onState?.(null);
    }
  }, [vars]);

  if (fail) return <p class="muted">Виджет «{params.w}» не загрузился.</p>;
  const controls = mod && vars ? mod.controls(params, scope) : [];
  return (
    <div class="widget">
      <div ref={host} class="widget-canvas" />
      {controls.map((c) =>
        c.type === 'actions' ? (
          <div class="choice" key={c.name} role="group">
            {c.actions.map((a) => (
              <button key={a.label} type="button" class="chip" onClick={() => inst.current?.act?.(c.name, a)}>
                {a.label}
              </button>
            ))}
          </div>
        ) : c.type === 'slider' ? (
          <label class="slider" key={c.name}>
            <span>
              {c.name} = <b>{fmtNum(Number(Number(vars[c.name]).toPrecision(5)))}</b>
            </span>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={vars[c.name]}
              onInput={(e) => setVars((v) => ({ ...v, [c.name]: Number(e.currentTarget.value) }))}
            />
          </label>
        ) : (
          <div class="choice" key={c.name} role="group">
            {c.options.map((o, i) => (
              <button
                key={o}
                type="button"
                class={'chip' + (vars[c.name] === o ? ' on' : '')}
                onClick={() => setVars((v) => ({ ...v, [c.name]: o }))}
              >
                {c.labels?.[i] ?? o}
              </button>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
