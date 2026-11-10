const NUM = ['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', '/', '0', ',', 'C', ''];

/** Экранная клавиатура. onKey получает строку-вставку или '⌫' / 'C'. */
export function Keypad({ keys, onKey, cols = 4 }) {
  return (
    <div class="keypad" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {keys.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button key={i} type="button" class={'key' + (k === '⌫' || k === 'C' ? ' key-alt' : '')} onClick={() => onKey(k)}>
            {(k.length > 1 ? k.replace('(', '') : k).replace('*', '·')}
          </button>
        ),
      )}
    </div>
  );
}

export const NUM_KEYS = NUM;

export function exprKeys(vars) {
  const v = vars.slice(0, 2);
  return [
    '7', '8', '9', '(', ')',
    '4', '5', '6', '+', '\u2212',
    '1', '2', '3', '*', '/',
    '0', ',', '^', '√(', 'π',
    ...v, ...Array(2 - v.length).fill(''), 'sin(', 'cos(', 'ln(',
    'exp(', 'tan(', 'abs(', '⌫', 'C',
  ];
}

/** Применяет клавишу к строке. */
export function applyKey(s, k) {
  if (k === '⌫') return s.slice(0, -1);
  if (k === 'C') return '';
  return s + k;
}
