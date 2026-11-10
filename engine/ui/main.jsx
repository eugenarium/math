// @ts-check
import { render } from 'preact';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import './app.css';

// Заглушка этапа 0, шаг 1: страница открывается с телефона, KaTeX подключён.
// Плеер урока появится на шаге 2 (docs/PLAN.md).
function App() {
  const formula = katex.renderToString('\\int_a^b f(x)\\,dx = \\lim_{n\\to\\infty}\\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x', {
    displayMode: true,
    throwOnError: false,
  });
  return (
    <main>
      <h1>Матбук</h1>
      <p>Интерактивный учебник вузовской математики и статистики.</p>
      <div dangerouslySetInnerHTML={{ __html: formula }} />
      <p class="muted">Каркас готов. Движок и уроки — по плану в docs/PLAN.md.</p>
    </main>
  );
}

render(<App />, /** @type {HTMLElement} */ (document.getElementById('app')));
