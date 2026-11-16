import { useEffect, useRef, useState } from 'preact/hooks';
import { PAGE_W, PAGE_STEP, PAGE_MAX, emptyPage, loadNotes, saveNotes, hitsStroke, compactPath, contentBottom } from '../core/notes.js';

const COLORS = { k: null, b: '#2563eb', r: '#dc2626', g: '#16a34a' };
const WIDTHS = { 3: 'тонко', 6: 'средне', 12: 'жирно' };
const ERASER_R = 22;

const inkColor = () => getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111';
const paperColor = () => getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff';

function drawStroke(ctx, st, ink) {
  ctx.strokeStyle = COLORS[st.c] ?? ink;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = st.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const p = st.p;
  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], st.w / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.stroke();
}

/**
 * Тетрадь: рисование пальцем или стилусом. id — ключ листа (урок или 'free').
 * Инструменты: перо, ластик (стирает штрих целиком), рука (прокрутка листа пальцем).
 */
export function Notes({ id, title, onClose }) {
  const canvas = useRef(null);
  const wrap = useRef(null);
  const [page, setPage] = useState(() => loadNotes()[id] ?? emptyPage());
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('k');
  const [width, setWidth] = useState(6);
  const [saved, setSaved] = useState(true);
  const live = useRef({ page, cur: null, hist: [], erased: false });
  live.current.page = page;

  const commit = (next, record = true) => {
    if (record) live.current.hist = [...live.current.hist.slice(-49), live.current.page];
    live.current.page = next;
    setPage(next);
    const all = loadNotes();
    if (next.s.length) all[id] = next;
    else delete all[id];
    setSaved(saveNotes(all));
  };

  // перерисовка при изменении листа, размера окна и темы
  const redraw = () => {
    const cv = canvas.current;
    if (!cv) return;
    const pg = live.current.page;
    const cssW = cv.clientWidth;
    const k = cssW / PAGE_W;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(cssW * dpr);
    const h = Math.round(pg.h * k * dpr);
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    ctx.fillStyle = paperColor();
    ctx.fillRect(0, 0, PAGE_W, pg.h);
    // линовка
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#ddd';
    ctx.lineWidth = 1.5;
    for (let y = 100; y < pg.h; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PAGE_W, y);
      ctx.stroke();
    }
    const ink = inkColor();
    for (const st of pg.s) drawStroke(ctx, st, ink);
    if (live.current.cur) drawStroke(ctx, live.current.cur, ink);
  };
  useEffect(redraw, [page]);
  useEffect(() => {
    const on = () => redraw();
    window.addEventListener('resize', on);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', on);
    return () => {
      window.removeEventListener('resize', on);
      mq?.removeEventListener?.('change', on);
    };
  }, []);

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect();
    const k = PAGE_W / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };

  const eraseAt = (x, y) => {
    const pg = live.current.page;
    const keep = pg.s.filter((st) => !hitsStroke(st, x, y, ERASER_R));
    if (keep.length !== pg.s.length) {
      if (!live.current.erased) live.current.hist = [...live.current.hist.slice(-49), pg];
      live.current.erased = true;
      commit({ ...pg, s: keep }, false);
    }
  };

  const down = (e) => {
    if (tool === 'hand') return;
    e.preventDefault();
    canvas.current.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    if (tool === 'eraser') {
      live.current.erased = false;
      live.current.erasing = true;
      eraseAt(x, y);
    } else {
      live.current.cur = { c: color, w: width, p: [x, y] };
      redraw();
    }
  };
  const move = (e) => {
    const [x, y] = pos(e);
    if (tool === 'eraser' && live.current.erasing) return eraseAt(x, y);
    const cur = live.current.cur;
    if (!cur) return;
    const evs = e.getCoalescedEvents?.() ?? [e];
    for (const ev of evs.length ? evs : [e]) {
      const [cx, cy] = pos(ev);
      cur.p.push(cx, cy);
    }
    redraw();
  };
  const up = () => {
    live.current.erasing = false;
    const cur = live.current.cur;
    if (!cur) return;
    live.current.cur = null;
    const pg = live.current.page;
    const st = { ...cur, p: compactPath(cur.p) };
    commit({ ...pg, s: [...pg.s, st] });
  };

  const undo = () => {
    const h = live.current.hist;
    if (!h.length) return;
    const prev = h[h.length - 1];
    live.current.hist = h.slice(0, -1);
    commit(prev, false);
  };
  const clear = () => {
    if (!page.s.length) return;
    if (confirm('Стереть весь лист?')) commit({ ...page, s: [] });
  };
  const extend = () => {
    if (page.h < PAGE_MAX) commit({ ...page, h: Math.min(PAGE_MAX, page.h + PAGE_STEP) }, false);
  };
  const exportPng = () => {
    const cv = canvas.current;
    const bottom = Math.min(page.h, Math.max(400, contentBottom(page) + 60));
    const k = cv.width / PAGE_W;
    const out = document.createElement('canvas');
    out.width = cv.width;
    out.height = Math.round(bottom * k);
    out.getContext('2d').drawImage(cv, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
    out.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `matbook-note-${id.replace(/\W+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  };

  return (
    <div class="notes" role="dialog" aria-label="Заметки">
      <header class="topbar">
        <button type="button" class="back" onClick={onClose} aria-label="Закрыть заметки">
          ←
        </button>
        <div class="title">
          <strong>Заметки</strong>
          <span class="muted">{title}</span>
        </div>
      </header>
      <div class="tools">
        <div class="seg tool-seg" role="group" aria-label="Инструмент">
          {[['pen', '✎ Перо'], ['eraser', '⌫ Ластик'], ['hand', '✋ Лист']].map(([k, label]) => (
            <button key={k} type="button" class={tool === k ? 'on' : ''} onClick={() => setTool(k)}>
              {label}
            </button>
          ))}
        </div>
        <div class="tool-row">
          {Object.keys(COLORS).map((c) => (
            <button key={c} type="button" class={'swatch c-' + c + (color === c && tool === 'pen' ? ' on' : '')} aria-label={'Цвет ' + c} onClick={() => (setColor(c), setTool('pen'))} />
          ))}
          <span class="sep" />
          {Object.entries(WIDTHS).map(([w, label]) => (
            <button key={w} type="button" class={'wbtn' + (width === Number(w) ? ' on' : '')} aria-label={label} onClick={() => (setWidth(Number(w)), setTool('pen'))}>
              <i style={{ width: 8 + Number(w) * 1.5 + 'px', height: 8 + Number(w) * 1.5 + 'px' }} />
            </button>
          ))}
          <span class="sep" />
          <button type="button" class="tbtn" onClick={undo} aria-label="Отменить">
            ↶
          </button>
        </div>
      </div>
      <div class="sheet" ref={wrap}>
        <canvas
          ref={canvas}
          class={'paper tool-' + tool}
          style={{ aspectRatio: `${PAGE_W} / ${page.h}` }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        <div class="sheet-foot">
          <button type="button" class="btn" onClick={extend} disabled={page.h >= PAGE_MAX}>
            + Ещё место
          </button>
          <button type="button" class="btn" onClick={exportPng} disabled={!page.s.length}>
            Сохранить PNG
          </button>
          <button type="button" class="btn ghost" onClick={clear} disabled={!page.s.length}>
            Стереть всё
          </button>
        </div>
        {!saved && <p class="feedback warn">Не удалось сохранить: хранилище браузера заполнено или недоступно.</p>}
        <p class="muted">Заметки хранятся только на этом устройстве и входят в копию прогресса.</p>
      </div>
    </div>
  );
}
