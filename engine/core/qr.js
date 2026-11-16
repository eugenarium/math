// @ts-check
// Генератор QR-кода без зависимостей: байтовый режим, уровень коррекции M, версии 1–10.
// Работает офлайн. Для ссылки вида https://имя.github.io/math/ хватает версии 3.
// Схема построения описана в ISO/IEC 18004; функции названы по этапам: функциональные модули,
// кодовые слова с коррекцией Рида–Соломона, размещение змейкой, маска, информация о формате.

/** Блоки уровня M по версиям: [байт коррекции на блок, [[число блоков, байт данных в блоке], …]]. */
const BLOCKS_M = [
  null,
  [10, [[1, 16]]],
  [16, [[1, 28]]],
  [26, [[1, 44]]],
  [18, [[2, 32]]],
  [24, [[2, 43]]],
  [16, [[4, 27]]],
  [18, [[4, 31]]],
  [22, [[2, 38], [2, 39]]],
  [22, [[3, 36], [2, 37]]],
  [26, [[4, 43], [1, 44]]],
];

export const MAX_VERSION = 10;

/** Число байт данных (без коррекции) для версии. */
const dataBytes = (v) => BLOCKS_M[v][1].reduce((s, [n, d]) => s + n * d, 0);

/** Наибольшая длина строки в байтах, которую можно закодировать в версии v (режим 0100 + счётчик). */
export const capacityBytes = (v) => dataBytes(v) - 1 - (v <= 9 ? 1 : 2);

// ───────── поле Галуа GF(256), многочлен 0x11D ─────────

const EXP = new Array(512);
const LOG = new Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Порождающий многочлен степени n (коэффициенты без старшего, старший равен 1). */
function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gmul(g[j], EXP[i]);
    }
    g = next;
  }
  return g.slice(1);
}

/** Байты коррекции Рида–Соломона для данных. @param {number[]} data @param {number} ecLen */
export function reedSolomon(data, ecLen) {
  const g = generator(ecLen);
  const rem = new Array(ecLen).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < ecLen; i++) rem[i] ^= gmul(g[i], factor);
  }
  return rem;
}

// ───────── кодовые слова ─────────

/** Данные в байтовом режиме, дополненные до длины версии. */
function dataCodewords(bytes, v) {
  const bits = [];
  const put = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, v <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const total = dataBytes(v) * 8;
  put(0, Math.min(4, total - bits.length));
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; out.length < dataBytes(v); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Разбивает данные на блоки, считает коррекцию и чередует байты. */
function interleave(data, v) {
  const [ecLen, groups] = BLOCKS_M[v];
  const blocks = [];
  let pos = 0;
  for (const [n, d] of groups) {
    for (let i = 0; i < n; i++) {
      const chunk = data.slice(pos, pos + d);
      pos += d;
      blocks.push({ data: chunk, ec: reedSolomon(chunk, ecLen) });
    }
  }
  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

// ───────── матрица ─────────

const sizeOf = (v) => 17 + 4 * v;

function alignmentPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const size = sizeOf(v);
  const step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const pos = [6];
  for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
  return pos;
}

/** Биты информации о формате (15 бит, уже со маской 0x5412) для уровня M и номера маски. */
export function formatBits(mask) {
  const data = (0b00 << 3) | mask; // уровень M кодируется как 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(v) {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (v << 12) | rem;
}

const bit = (x, i) => ((x >>> i) & 1) === 1;

/** Матрица функциональных модулей: служебные области и их значения. */
function buildFunction(v) {
  const size = sizeOf(v);
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    isFn[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const al = alignmentPositions(v);
  for (let i = 0; i < al.length; i++) {
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  drawFormat(0, set, size); // место под формат помечается служебным; значение уточняется после выбора маски
  if (v >= 7) {
    const bits = versionBits(v);
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(bits, i));
      set(b, a, bit(bits, i));
    }
  }
  return { modules, isFn };
}

function drawFormat(mask, set, size) {
  const bits = formatBits(mask);
  for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
  set(8, 7, bit(bits, 6));
  set(8, 8, bit(bits, 7));
  set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
  set(8, size - 8, true); // тёмный модуль
}

/** Размещает кодовые слова змейкой снизу вверх по парам столбцов. */
function placeCodewords(modules, isFn, codewords) {
  const size = modules.length;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && i < codewords.length * 8) {
          modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

export const maskFunction = (mask) => MASKS[mask];

function applyMask(modules, isFn, mask) {
  const size = modules.length;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!isFn[r][c] && MASKS[mask](r, c)) modules[r][c] = !modules[r][c];
}

/** Штраф маски по четырём правилам стандарта (меньше — лучше читается). */
function penalty(m) {
  const n = m.length;
  let score = 0;
  const runs = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b <= n; b++) {
        if (b < n && get(a, b) === get(a, b - 1)) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
    }
  };
  runs((r, c) => m[r][c]);
  runs((c, r) => m[r][c]);
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  const pat = [true, false, true, true, true, false, true];
  const light4 = (cells) => cells.every((x) => !x);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c + 6 < n; c++) {
      const rowSeg = pat.every((p, k) => m[r][c + k] === p);
      if (rowSeg) {
        const before = [c - 4, c - 3, c - 2, c - 1].map((x) => (x >= 0 ? m[r][x] : false));
        const after = [c + 7, c + 8, c + 9, c + 10].map((x) => (x < n ? m[r][x] : false));
        if (light4(before) || light4(after)) score += 40;
      }
      const colSeg = pat.every((p, k) => m[c + k][r] === p);
      if (colSeg) {
        const before = [c - 4, c - 3, c - 2, c - 1].map((x) => (x >= 0 ? m[x][r] : false));
        const after = [c + 7, c + 8, c + 9, c + 10].map((x) => (x < n ? m[x][r] : false));
        if (light4(before) || light4(after)) score += 40;
      }
    }
  }
  const dark = m.flat().filter(Boolean).length;
  const k = Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1;
  return score + Math.max(0, k) * 10;
}

/**
 * Строит QR-код для строки. Возвращает матрицу [строка][столбец], true — тёмный модуль.
 * @param {string} text
 * @returns {boolean[][]}
 */
export function encodeQr(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let v = 1;
  while (v <= MAX_VERSION && bytes.length > capacityBytes(v)) v++;
  if (v > MAX_VERSION) throw new Error('Текст слишком длинный для QR-кода: ' + bytes.length + ' байт');
  const codewords = interleave(dataCodewords(bytes, v), v);
  const { modules, isFn } = buildFunction(v);
  placeCodewords(modules, isFn, codewords);
  const size = modules.length;
  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const trial = modules.map((row) => row.slice());
    applyMask(trial, isFn, mask);
    const set = (x, y, dark) => {
      trial[y][x] = dark;
    };
    drawFormat(mask, set, size);
    const s = penalty(trial);
    if (s < bestScore) {
      bestScore = s;
      best = trial;
    }
  }
  return /** @type {boolean[][]} */ (best);
}

/** SVG-путь для матрицы: один path из квадратов, с тихой зоной 4 модуля. */
export function qrSvg(matrix, quiet = 4) {
  const n = matrix.length;
  const total = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!matrix[r][c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < n && matrix[r][end]) end++;
      d += `M${c + quiet},${r + quiet}h${end - c}v1h${c - end}z`;
      c = end;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR-код со ссылкой на приложение"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
