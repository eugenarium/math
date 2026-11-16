import { isUnlocked, LESSON_DONE, LESSON_STARTED, LESSON_RETURN } from '../core/store.js';
import { dueLessons, dayNumber, DEBT_WARNING } from '../core/srs.js';

/** 1 урок, 2–4 урока, 5+ уроков */
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'урок' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'урока' : 'уроков');

const BADGE = { [LESSON_DONE]: '✓ пройден', [LESSON_STARTED]: '● начат', [LESSON_RETURN]: '↺ вернуться' };

export function Home({ data, state, update, onOpen, onReview, onSettings, onNotes }) {
  const openAll = state.set.openAll !== false;
  const bySection = {};
  for (const l of data.index) (bySection[l.sec] ??= []).push(l);
  const have = data.index.filter((l) => l.has);
  const done = have.filter((l) => state.L[l.id]?.[0] === LESSON_DONE).length;
  const cur = state.cur && data.lessons[state.cur.id] ? state.cur.id : null;
  const due = dueLessons(state.L, dayNumber()).filter((id) => data.lessons[id]);
  // рекомендация: первый по карте курса готовый урок, не пройденный, с открытыми предпосылками
  const today = dayNumber();
  const hasProgress = Object.keys(state.L).length > 0;
  const lastExport = state.set.lastExport;
  const backupDue = hasProgress && (lastExport === undefined ? Object.values(state.L).some((l) => l[0] === 1) : today - lastExport >= 30);
  const next = have.find((l) => state.L[l.id]?.[0] !== LESSON_DONE && l.id !== cur && (openAll || isUnlocked(state, l.pre)));

  const pct = have.length ? Math.round((done / have.length) * 100) : 0;
  const dotOf = (l, st, unlocked, can) => {
    if (!l.has) return ['soon', ''];
    if (st === LESSON_DONE) return ['done', '✓'];
    if (st === LESSON_STARTED) return ['started', ''];
    if (st === LESSON_RETURN) return ['back', '↺'];
    return [can ? 'open' : 'off', can ? '' : '🔒'];
  };

  return (
    <main class="home">
      <header class="home-head">
        <h1>Матбук</h1>
        <div class="head-btns">
          <button type="button" class="icon-btn" aria-label="Тетрадь для заметок" onClick={onNotes}>
            ✎
          </button>
          <button type="button" class="icon-btn" aria-label="Прогресс, копия, поделиться" onClick={onSettings}>
            ⚙
          </button>
        </div>
      </header>

      <section class="overview">
        <div class="nums">
          <span class="big">
            {done} <span class="muted">из {have.length} пройдено</span>
          </span>
          <span class="muted">{pct}%</span>
        </div>
        <div class="meter" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
          <i style={{ width: pct + '%' }} />
        </div>
        <p class="muted" style="margin:8px 0 0">
          Готово уроков: {have.length} из {data.index.length} по карте курса.
        </p>
      </section>

      {backupDue && (
        <button type="button" class="feedback warn backup" onClick={onSettings}>
          {lastExport === undefined ? 'Сохрани копию прогресса: хранилище браузера могут очистить.' : 'Прошёл месяц с последней копии прогресса. Сохранить сейчас?'}
        </button>
      )}
      {due.length > DEBT_WARNING && <p class="feedback warn">Накопилось больше {DEBT_WARNING} повторений. Сессия берёт по 10 уроков за раз.</p>}
      <div class="actions">
        {due.length > 0 && (
          <button type="button" class="btn primary wide" onClick={onReview}>
            Повторить сегодня: {due.length} {plural(due.length)}
          </button>
        )}
        {cur && (
          <button type="button" class={'btn wide' + (due.length ? '' : ' primary')} onClick={() => onOpen(cur)}>
            Продолжить: {data.cards[cur].t}
          </button>
        )}
        {next && !cur && (
          <button type="button" class={'btn wide' + (due.length ? '' : ' primary')} onClick={() => onOpen(next.id)}>
            Следующий урок: {next.t}
          </button>
        )}
      </div>

      {Object.entries(bySection).map(([sec, items]) => {
        const n = items.filter((l) => l.has).length;
        const d = items.filter((l) => state.L[l.id]?.[0] === LESSON_DONE).length;
        return (
          <details key={sec} open={n > 0 && d < n} class="section">
            <summary>
              <span class="name">{data.sections[sec]}</span>
              <span class="muted count">
                {d}/{n}
                {n < items.length ? ` · всего ${items.length}` : ''}
              </span>
              <span class={'meter' + (n > 0 && d === n ? ' ok' : '')}>
                <i style={{ width: (n ? (d / n) * 100 : 0) + '%' }} />
              </span>
            </summary>
            <ul class="lessons">
              {items.map((l) => {
                const st = state.L[l.id]?.[0];
                const unlocked = isUnlocked(state, l.pre);
                const can = l.has && (unlocked || openAll);
                const [cls, mark] = dotOf(l, st, unlocked, can);
                return (
                  <li key={l.id}>
                    <button type="button" class={'lesson-row' + (can ? '' : ' off')} disabled={!can} onClick={() => onOpen(l.id)}>
                      <span class={'dot ' + cls} aria-hidden="true">
                        {mark}
                      </span>
                      <span class="lt">
                        {l.t}
                        {l.p !== 'core' && l.has && <span class="tag">{l.p === 'ext' ? 'расширение' : 'опция'}</span>}
                      </span>
                      <span class="meta muted">{!l.has ? 'скоро' : BADGE[st] ?? (unlocked ? l.min + ' мин' : 'закрыт')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      <footer class="foot">
        <button type="button" class="btn ghost wide" onClick={onSettings}>
          Прогресс, копия, поделиться
        </button>
        <label class="toggle">
          <input type="checkbox" checked={openAll} onChange={(e) => update((s) => void (s.set.openAll = e.currentTarget.checked))} />
          Открыть все готовые уроки, не проходя предпосылки
        </label>
      </footer>
    </main>
  );
}
