import { useState, useMemo } from 'preact/hooks';
import { exportJson, importJson } from '../core/store.js';
import { dayNumber } from '../core/srs.js';
import { encodeQr, qrSvg } from '../core/qr.js';

/** Поделиться приложением: QR-код со ссылкой (рисуется на устройстве, работает офлайн), системное меню и копирование. */
function ShareBlock() {
  const url = useMemo(() => {
    const u = new URL('./', location.href);
    return u.origin + u.pathname;
  }, []);
  const svg = useMemo(() => {
    try {
      return qrSvg(encodeQr(url));
    } catch {
      return '';
    }
  }, [url]);
  const [note, setNote] = useState(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = async () => {
    try {
      await navigator.share({ title: 'Матбук', text: 'Интерактивный учебник математики и статистики', url });
    } catch (e) {
      if (e?.name !== 'AbortError') setNote({ ok: false, text: 'Не удалось открыть меню «Поделиться». Скопируй ссылку.' });
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setNote({ ok: true, text: 'Ссылка скопирована.' });
    } catch {
      setNote({ ok: false, text: 'Не удалось скопировать. Выдели ссылку выше и скопируй вручную.' });
    }
  };

  return (
    <section class="share">
      <h3>Поделиться приложением</h3>
      <p class="muted">Покажи QR-код: у друга откроется то же приложение. Камера телефона распознаёт его без дополнительных программ.</p>
      {svg && <div class="qr" dangerouslySetInnerHTML={{ __html: svg }} />}
      <p class="share-link">{url}</p>
      <div class="row">
        {canShare && (
          <button type="button" class="btn primary" onClick={share}>
            Отправить ссылку
          </button>
        )}
        <button type="button" class={'btn' + (canShare ? ' ghost' : ' primary')} onClick={copy}>
          Скопировать ссылку
        </button>
      </div>
      {note && <p class={'feedback ' + (note.ok ? 'ok' : 'warn')}>{note.text}</p>}
    </section>
  );
}

/** Копия прогресса: скачать файл, загрузить файл. Хранилище браузера могут очистить, копия — единственная страховка. */
export function Settings({ state, update, replace, onExit }) {
  const [msg, setMsg] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const doExport = () => {
    const today = dayNumber();
    const blob = new Blob([exportJson({ ...state, set: { ...state.set, lastExport: today } })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `matbook-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    update((s) => void (s.set.lastExport = today));
    setMsg({ ok: true, text: 'Файл сохранён. Храни его вне телефона: в почте или облаке.' });
  };

  const doImport = async (e) => {
    const input = e.currentTarget; // после await currentTarget уже пуст
    const file = input.files?.[0];
    if (!file) return;
    try {
      const next = importJson(await file.text());
      replace(next);
      setMsg({ ok: true, text: `Прогресс загружен: уроков в истории ${Object.keys(next.L).length}.` });
    } catch (err) {
      setMsg({ ok: false, text: 'Не удалось прочитать файл: ' + err.message });
    }
    input.value = '';
  };

  const done = Object.values(state.L).filter((l) => l[0] === 1).length;
  return (
    <div class="lesson">
      <header class="topbar">
        <button type="button" class="back" onClick={onExit} aria-label="Назад">
          ←
        </button>
        <div class="title">
          <strong>Прогресс, копия, поделиться</strong>
        </div>
      </header>
      <main class="screen">
        <p>
          Прогресс хранится только в этом браузере. Если систему очистит данные сайта, он пропадёт. Раз в месяц сохраняй копию.
        </p>
        <p class="muted">Пройдено уроков: {done}.</p>

        <h3>Тема</h3>
        <div class="seg" role="group" aria-label="Тема оформления">
          {[['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, label]) => (
            <button key={k} type="button" class={(state.set.theme ?? 'auto') === k ? 'on' : ''} onClick={() => update((x) => void (x.set.theme = k))}>
              {label}
            </button>
          ))}
        </div>

        <button type="button" class="btn primary wide" onClick={doExport}>
          Сохранить копию в файл
        </button>

        <label class="btn wide file">
          Загрузить копию из файла
          <input type="file" accept="application/json,.json" onChange={doImport} hidden />
        </label>
        <p class="muted">Загрузка заменяет текущий прогресс на устройстве.</p>

        {msg && <p class={'feedback ' + (msg.ok ? 'ok' : 'warn')}>{msg.text}</p>}

        <ShareBlock />

        <h3>Сброс</h3>
        {!confirmReset ? (
          <button type="button" class="btn ghost wide" onClick={() => setConfirmReset(true)}>
            Стереть прогресс
          </button>
        ) : (
          <div class="card">
            <p>Прогресс на этом устройстве будет стёрт без возможности вернуть, если нет копии.</p>
            <div class="row">
              <button type="button" class="btn ghost" onClick={() => setConfirmReset(false)}>
                Отмена
              </button>
              <button
                type="button"
                class="btn danger"
                onClick={() => {
                  replace(null);
                  setConfirmReset(false);
                  setMsg({ ok: true, text: 'Прогресс стёрт.' });
                }}
              >
                Стереть
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
