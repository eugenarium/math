import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr, qrSvg, reedSolomon, formatBits, capacityBytes, MAX_VERSION } from './qr.js';

// формулы масок записаны отдельно от кодировщика (по таблице стандарта: i — строка, j — столбец)
const MASK_TEST = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

// ───── эталонные значения из спецификации и учебных разборов ─────

test('Рид–Соломон: эталонный пример HELLO WORLD (версия 1-M)', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(reedSolomon(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('Рид–Соломон: эталонный пример 01234567 (версия 1-M)', () => {
  const data = [0b00010000, 0b00100000, 0b00001100, 0b01010110, 0b01100001, 0b10000000, 0b11101100, 0b00010001, 0b11101100, 0b00010001, 0b11101100, 0b00010001, 0b11101100, 0b00010001, 0b11101100, 0b00010001];
  const ec = [0b10100101, 0b00100100, 0b11010100, 0b11000001, 0b11101101, 0b00110110, 0b11000111, 0b10000111, 0b00101100, 0b01010101];
  assert.deepEqual(reedSolomon(data, 10), ec);
});

test('информация о формате: таблица уровня M из стандарта', () => {
  const table = [
    '101010000010010', '101000100100101', '101111001111100', '101101101001011',
    '100010111111001', '100000011001110', '100111110010111', '100101010100000',
  ];
  table.forEach((s, mask) => assert.equal(formatBits(mask), parseInt(s, 2), 'маска ' + mask));
});

test('вместимость версий и размер матрицы', () => {
  assert.equal(capacityBytes(1), 14);
  assert.equal(capacityBytes(2), 26);
  assert.equal(capacityBytes(3), 42);
  assert.equal(capacityBytes(10), 213);
  assert.equal(encodeQr('a').length, 21);
  assert.equal(encodeQr('https://eugenarium.github.io/math/').length, 29); // версия 3
  assert.throws(() => encodeQr('x'.repeat(capacityBytes(MAX_VERSION) + 1)));
});

// ───── независимый декодер для круговой проверки ─────

const EXP = [];
const LOG = [];
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
}
const mul = (a, b) => (a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0);

const BLOCKS = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };
const ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

function decode(m) {
  const n = m.length;
  const v = (n - 17) / 4;
  // карта служебных модулей — по справочным таблицам, а не по коду кодировщика
  const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const mark = (r0, c0, r1, c1) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r >= 0 && c >= 0 && r < n && c < n) fn[r][c] = true;
  };
  mark(0, 0, 8, 8); // левый верхний поиск + разделитель + формат
  mark(0, n - 8, 8, n - 1); // правый верхний
  mark(n - 8, 0, n - 1, 8); // левый нижний
  mark(6, 0, 6, n - 1);
  mark(0, 6, n - 1, 6);
  const al = ALIGN[v] ?? [];
  for (let i = 0; i < al.length; i++) {
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      mark(al[i] - 2, al[j] - 2, al[i] + 2, al[j] + 2);
    }
  }
  if (v >= 7) {
    mark(0, n - 11, 5, n - 9);
    mark(n - 11, 0, n - 9, 5);
  }
  // формат: первая копия (около левого верхнего поиска) и вторая
  const firstCopy = [];
  for (let i = 0; i <= 5; i++) firstCopy.push(m[i][8]);
  firstCopy.push(m[7][8], m[8][8], m[8][7]);
  for (let i = 9; i < 15; i++) firstCopy.push(m[8][14 - i]);
  const secondCopy = [];
  for (let i = 0; i < 8; i++) secondCopy.push(m[8][n - 1 - i]);
  for (let i = 8; i < 15; i++) secondCopy.push(m[n - 15 + i][8]);
  const val = (arr) => arr.reduce((s, b, i) => s | ((b ? 1 : 0) << i), 0);
  assert.equal(val(firstCopy), val(secondCopy), 'копии формата должны совпадать');
  const fmt = val(firstCopy);
  let mask = -1;
  for (let k = 0; k < 8; k++) if (formatBits(k) === fmt) mask = k;
  assert.ok(mask >= 0, 'формат не распознан');
  assert.equal(m[n - 8][8], true, 'тёмный модуль');
  // чтение змейкой, снятие маски
  const bits = [];
  let up = true;
  for (let col = n - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (fn[r][c]) continue;
        bits.push(m[r][c] !== MASK_TEST[mask](r, c));
      }
    }
    up = !up;
  }
  const raw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) raw.push(bits.slice(i, i + 8).reduce((s, b) => (s << 1) | (b ? 1 : 0), 0));
  const [ecLen, groups] = BLOCKS[v];
  const sizes = groups.flatMap(([cnt, d]) => new Array(cnt).fill(d));
  const total = sizes.reduce((s, d) => s + d + ecLen, 0);
  const cw = raw.slice(0, total);
  // разворот чередования
  const blocks = sizes.map(() => []);
  let p = 0;
  for (let i = 0; i < Math.max(...sizes); i++) sizes.forEach((d, b) => { if (i < d) blocks[b].push(cw[p++]); });
  const ecs = sizes.map(() => []);
  for (let i = 0; i < ecLen; i++) sizes.forEach((_, b) => ecs[b].push(cw[p++]));
  // проверка синдромов: значение многочлена данные+коррекция в точках α^0..α^(ecLen-1) равно нулю
  blocks.forEach((data, b) => {
    const word = [...data, ...ecs[b]];
    for (let s = 0; s < ecLen; s++) {
      let acc = 0;
      for (const c of word) acc = mul(acc, EXP[s]) ^ c;
      assert.equal(acc, 0, `синдром ${s} блока ${b}`);
    }
  });
  const data = blocks.flat();
  // разбор байтового режима
  let pos = 0;
  const take = (len) => {
    let x = 0;
    for (let i = 0; i < len; i++) {
      x = (x << 1) | ((data[pos >> 3] >> (7 - (pos & 7))) & 1);
      pos++;
    }
    return x;
  };
  assert.equal(take(4), 0b0100, 'режим: байты');
  const len = take(v <= 9 ? 8 : 16);
  const out = [];
  for (let i = 0; i < len; i++) out.push(take(8));
  return new TextDecoder().decode(new Uint8Array(out));
}

test('круговая проверка: закодировать и разобрать независимым декодером', () => {
  const samples = [
    'a',
    'HELLO WORLD',
    'https://eugenarium.github.io/math/',
    'https://example.com/путь?x=1&y=2#часть',
    'x'.repeat(capacityBytes(4)),
    'y'.repeat(capacityBytes(7)),
    'z'.repeat(capacityBytes(8)),
    'w'.repeat(capacityBytes(9)),
    'q'.repeat(capacityBytes(10)),
  ];
  for (const text of samples) {
    const m = encodeQr(text);
    assert.equal(decode(m), text, text.slice(0, 30));
  }
});

test('поисковые узоры, синхронизация и тихая зона в SVG', () => {
  const m = encodeQr('https://eugenarium.github.io/math/');
  const n = m.length;
  const finder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        assert.equal(m[r0 + r][c0 + c], ring !== 2, `узор в (${r0 + r}, ${c0 + c})`);
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) assert.equal(m[6][i], i % 2 === 0);
  const svg = qrSvg(m);
  assert.match(svg, /^<svg /);
  assert.match(svg, new RegExp(`viewBox="0 0 ${n + 8} ${n + 8}"`));
});
