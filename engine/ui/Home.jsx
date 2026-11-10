import { isUnlocked, LESSON_DONE, LESSON_STARTED, LESSON_RETURN } from '../core/store.js';
import { dueLessons, dayNumber, DEBT_WARNING } from '../core/srs.js';

/** 1 урок, 2–4 урока, 5+ уроков */
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'урок' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'урока' : 'уроков');

const BADGE = { [LESSON_DONE]: '✓ пройден', [LESSON_STARTED]: '● начат', [LESSON_RETURN]: '↺ вернуться' };

export function Home({ data, state, update, onOpen, onReview }) {
  const openAll = state.set.openAll !== false;
  const bySection = {};
  for (const l of data.index) (bySection[l.sec] ??= []).push(l);
  const have = data.index.filter((l) => l.has);
  const done = have.filter((l) => state.L[l.id]?.[0] === LESSON_DONE).length;
  const cur = state.cur && data.lessons[state.cur.id] ? state.cur.id : null;
  const due = dueLessons(state.L, dayNumber()).filter((id) => data.lessons[id]);
  // рекомендация: первый по карте курса готовый урок, не пройденный, с открытыми предпосылками
  const next = have.find((l) => state.L[l.id]?.[0] !== LESSON_DONE && l.id !== cur && (openAll || isUnlocked(state, l.pre)));

  return (
    <main class="home">
      <h1>Матбук</h1>
      <p class="muted">
        Готово уроков: {have.length} из {data.index.length}. Пройдено: {done}.
      </p>

      {due.length > 0 && (
        <button type="button" class="btn primary wide" onClick={onReview}>
          Повторить сегодня: {due.length} {plural(due.length)}
        </button>
      )}
      {due.length > DEBT_WARNING && <p class="feedback warn">Накопилось больше {DEBT_WARNING} повторений. Сессия берёт по 10 уроков за раз.</p>}
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

      {Object.entries(bySection).map(([sec, items]) => {
        const n = items.filter((l) => l.has).length;
        return (
          <details key={sec} open={n > 0} class="section">
            <summary>
              <span>{data.sections[sec]}</span>
              <span class="muted">
                {n}/{items.length}
              </span>
            </summary>
            <ul class="lessons">
              {items.map((l) => {
                const st = state.L[l.id]?.[0];
                const unlocked = isUnlocked(state, l.pre);
                const can = l.has && (unlocked || openAll);
                return (
                  <li key={l.id}>
                    <button type="button" class={'lesson-row' + (can ? '' : ' off')} disabled={!can} onClick={() => onOpen(l.id)}>
                      <span class="lt">{l.t}</span>
                      <span class="meta muted">
                        {!l.has ? 'скоро' : BADGE[st] ?? (unlocked ? l.min + ' мин' : 'закрыт')}
                        {l.p !== 'core' && l.has ? ' · ' + (l.p === 'ext' ? 'расширение' : 'опция') : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      <footer class="foot">
        <label class="toggle">
          <input type="checkbox" checked={openAll} onChange={(e) => update((s) => void (s.set.openAll = e.currentTarget.checked))} />
          Открыть все готовые уроки, не проходя предпосылки
        </label>
      </footer>
    </main>
  );
}
