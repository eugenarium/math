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
            {k.replace('(', '').replace('*', '·')}
          </button>
        ),
      )}
    </div>
  );
}

export const NUM_KEYS = NUM;

export function exprKeys(vars) {
  return [...vars, '^', '√(', 'π', '(', ')', '+', '−', '*', '/', 'sin(', 'cos(', 'tan(', 'ln(', 'exp(', '⌫'];
}

/** Применяет клавишу к строке. */
export function applyKey(s, k) {
  if (k === '⌫') return s.slice(0, -1);
  if (k === 'C') return '';
  return s + k;
}
