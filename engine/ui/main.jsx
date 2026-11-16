import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import 'katex/dist/katex.min.css';
import './app.css';
import data from 'virtual:content';
import { registerSW } from 'virtual:pwa-register';
import { load, save, fresh } from '../core/store.js';
import { Home } from './Home.jsx';
import { Lesson } from './Lesson.jsx';
import { Review } from './Review.jsx';
import { Settings } from './Settings.jsx';

/** Тема: 'auto' — по системе, иначе принудительно светлая или тёмная. */
export function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#f7f6f2');
}

function App() {
  const [state, setState] = useState(load);
  const [lessonId, setLessonId] = useState(null);
  const [review, setReview] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => applyTheme(state.set.theme), [state.set.theme]);

  /** Изменяет прогресс и сразу сохраняет его целиком. */
  const update = (fn) =>
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      save(next);
      return next;
    });

  /** Полная замена прогресса: импорт файла или сброс (null). */
  const replace = (next) => {
    const s = next ?? fresh();
    save(s);
    setState(s);
  };

  if (settings) return <Settings state={state} update={update} replace={replace} onExit={() => setSettings(false)} />;
  if (review) return <Review data={data} state={state} update={update} onExit={() => setReview(false)} />;
  if (lessonId) {
    return <Lesson key={lessonId} id={lessonId} data={data} state={state} update={update} onExit={() => setLessonId(null)} />;
  }
  return <Home data={data} state={state} update={update} onOpen={setLessonId} onReview={() => setReview(true)} onSettings={() => setSettings(true)} />;
}

// Офлайн-режим и защита от очистки хранилища
registerSW({ immediate: true });
navigator.storage?.persist?.().catch(() => {});

render(<App />, document.getElementById('app'));
