import { useState } from 'preact/hooks';
import { exportJson, importJson } from '../core/store.js';
import { dayNumber } from '../core/srs.js';

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
          <strong>Прогресс и копия</strong>
        </div>
      </header>
      <main class="screen">
        <p>
          Прогресс хранится только в этом браузере. Если систему очистит данные сайта, он пропадёт. Раз в месяц сохраняй копию.
        </p>
        <p class="muted">Пройдено уроков: {done}.</p>

        <button type="button" class="btn primary wide" onClick={doExport}>
          Сохранить копию в файл
        </button>

        <label class="btn wide file">
          Загрузить копию из файла
          <input type="file" accept="application/json,.json" onChange={doImport} hidden />
        </label>
        <p class="muted">Загрузка заменяет текущий прогресс на устройстве.</p>

        {msg && <p class={'feedback ' + (msg.ok ? 'ok' : 'warn')}>{msg.text}</p>}

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
