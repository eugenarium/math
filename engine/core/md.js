// @ts-check
// Мини-разметка: **жирный**, $формула$ (KaTeX), перенос строки.
import katex from 'katex';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function tex(src, display = false) {
  return katex.renderToString(src, { throwOnError: false, strict: 'ignore', displayMode: display });
}

/** @param {string} text @returns {string} HTML */
export function mini(text) {
  return String(text)
    .split(/\$([^$]+)\$/)
    .map((part, i) => (i % 2 ? tex(part) : esc(part).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')))
    .join('');
}
