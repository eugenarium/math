// @ts-check
// Общие функции виджетов: вычисление параметров, начальное состояние, достижимость цели.
import { evalExpr } from '../core/mathx.js';

/** Параметр-выражение → значение (число, массив чисел). Строка вычисляется в scope. */
export function evalParam(val, scope) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return evalExpr(val, scope);
  if (Array.isArray(val)) return val.map((x) => evalParam(x, scope));
  return val;
}

/** Функция одной переменной из выражения: NaN вне области определения. */
export function makeFn(src, scope, name = 'x') {
  const base = { ...scope };
  return (x) => {
    try {
      const r = evalExpr(src, { ...base, [name]: x });
      return typeof r === 'number' ? r : NaN;
    } catch {
      return NaN;
    }
  };
}

/** Слайдер: [min, max, начало, шаг] */
export function sliderSpec(name, a) {
  const [min, max, start = min, step] = a;
  return { name, type: 'slider', min, max, start, step: step ?? (max - min) / 100 };
}

/** Значения переменных без «точечных» имён (P.x) — для области видимости выражений. */
export function scopeVars(vars) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, v] of Object.entries(vars)) if (!k.includes('.') && typeof v === 'number') out[k] = v;
  return out;
}

const LIMIT = 600;

/**
 * Достижима ли цель goal: перебор слайдеров по сетке, вариантов переключателей и перетаскиваемых элементов.
 * Модуль может объявить dragAxes(params, scope) → [[патч, …], …]: оси перебора для того, что ученик двигает пальцем
 * (пробный вектор, границы области). Используется тестами и линтером (E310).
 */
export function goalReachable(mod, params, scope, goal) {
  const controls = mod.controls(params, scope);
  const axes = controls.filter((c) => c.type !== 'actions').map((c) => {
    if (c.type === 'choice') return c.options.map((o) => ({ [c.name]: o }));
    const n = Math.min(LIMIT, Math.max(1, Math.round((c.max - c.min) / c.step)));
    return Array.from({ length: n + 1 }, (_, i) => ({ [c.name]: Number((c.min + ((c.max - c.min) * i) / n).toFixed(6)) }));
  });
  axes.push(...(mod.dragAxes?.(params, scope) ?? []));
  const base = mod.initial(params, scope);
  const check = (vars) => {
    let out;
    try {
      out = mod.compute(params, scope, vars);
    } catch {
      return false;
    }
    return Object.entries(goal).every(([k, [target, tol]]) => typeof out[k] === 'number' && Math.abs(out[k] - target) <= tol);
  };
  const walk = (i, vars) => {
    if (i === axes.length) return check(vars);
    return axes[i].some((patch) => walk(i + 1, { ...vars, ...patch }));
  };
  return walk(0, base);
}

/** Окно по значениям: объединение окон при начальных, минимальных и максимальных значениях каждого слайдера. */
export function unionOverSliders(mod, params, scope, measure) {
  const vars0 = mod.initial(params, scope);
  const sets = [vars0];
  for (const c of mod.controls(params, scope)) {
    if (c.type !== 'slider') continue;
    sets.push({ ...vars0, [c.name]: c.min }, { ...vars0, [c.name]: c.max });
  }
  const acc = [];
  for (const v of sets) {
    try {
      acc.push(measure(v));
    } catch {
      /* значение вне области определения — пропускаем */
    }
  }
  return acc;
}
