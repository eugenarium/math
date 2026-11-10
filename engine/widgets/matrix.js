// @ts-check
// Пошаговое выполнение матричных алгоритмов: шаги строит движок, ученик открывает их по одному.
import { mini } from '../core/md.js';
import { evalParam } from './kit.js';
import { run } from './matrixAlgo.js';

export const meta = {
  name: 'matrix',
  params: {
    M: ['E[][]', null, 'матрица: числа, выражения или имя матрицы'],
    B: ['E[][]', null, 'второй сомножитель (для op: mul)'],
    op: ['enum', 'gauss', 'gauss | rref | det | inv | mul | lu | T | gs | char'],
    auto: ['flag', 1, 'показ шагов движком; режим auto: 0 (ученик выбирает операции) пока не реализован'],
    frac: ['flag', 0, '1 — обыкновенные дроби вместо десятичных'],
  },
  out: ['step', 'done'],
};

export function controls() {
  return [
    {
      name: 'steps',
      type: 'actions',
      actions: [
        { label: 'Шаг', k: 'next' },
        { label: 'Все шаги', k: 'all' },
        { label: 'Сначала', k: 'reset' },
      ],
    },
  ];
}

export function initial() {
  return { step: 1, done: 0 };
}

/** Шаги алгоритма при текущих параметрах. */
export function stepsOf(params, scope) {
  const M = evalParam(params.M, scope);
  const B = params.B === undefined ? undefined : evalParam(params.B, scope);
  return run(params.op ?? 'gauss', M, B, !!params.frac).steps;
}

export function compute(params, scope, vars) {
  const total = stepsOf(params, scope).length;
  return { step: vars.step, done: vars.step >= total ? 1 : 0 };
}

export function mount(el, { params, scope }, ctx = {}) {
  const steps = stepsOf(params, scope);
  let shown = 1;
  const box = document.createElement('div');
  box.className = 'matrix-steps';
  el.appendChild(box);

  const draw = () => {
    box.innerHTML = steps
      .slice(0, shown)
      .map((s, i) => `<div class="mstep${i === shown - 1 ? ' last' : ''}"><span class="mnum">${i + 1}</span><div>${mini(s)}</div></div>`)
      .join('');
    const last = box.lastElementChild;
    if (last && shown > 1) last.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };
  const report = () => ctx.onChange?.({ step: shown, done: shown >= steps.length ? 1 : 0 });

  draw();
  report();

  return {
    update() {},
    /** Кнопки: следующий шаг, все шаги, сначала. */
    act(_name, action) {
      if (action.k === 'next') shown = Math.min(steps.length, shown + 1);
      else if (action.k === 'all') shown = steps.length;
      else shown = 1;
      draw();
      report();
    },
    destroy() {
      box.remove();
    },
  };
}
