import { render } from 'preact';
import { useState } from 'preact/hooks';
import 'katex/dist/katex.min.css';
import './app.css';
import data from 'virtual:content';
import { load, save } from '../core/store.js';
import { Home } from './Home.jsx';
import { Lesson } from './Lesson.jsx';

function App() {
  const [state, setState] = useState(load);
  const [lessonId, setLessonId] = useState(null);

  /** Изменяет прогресс и сразу сохраняет его целиком. */
  const update = (fn) =>
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      save(next);
      return next;
    });

  if (lessonId) {
    return <Lesson key={lessonId} id={lessonId} data={data} state={state} update={update} onExit={() => setLessonId(null)} />;
  }
  return <Home data={data} state={state} update={update} onOpen={setLessonId} />;
}

render(<App />, document.getElementById('app'));
