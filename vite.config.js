// @ts-check
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { loadContent } from './tools/build.mjs';

const ID = 'virtual:content';

/** Виртуальный модуль с контентом: YAML → JSON, проверка схем; ошибки E блокируют сборку. */
function content() {
  return {
    name: 'mathbook-content',
    resolveId(id) {
      if (id === ID) return '\0' + ID;
    },
    load(id) {
      if (id !== '\0' + ID) return;
      const { data, errors } = loadContent();
      if (errors.length) this.error(errors.join('\n'));
      return 'export default ' + JSON.stringify(data);
    },
    configureServer(server) {
      server.watcher.add(['content', 'docs/COURSE_MAP.md', 'schema']);
      server.watcher.on('change', (f) => {
        if (!/[\\/](content|schema)[\\/]|COURSE_MAP/.test(f)) return;
        const mod = server.moduleGraph.getModuleById('\0' + ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

// base './' — сайт работает и из подкаталога GitHub Pages, и локально.
export default defineConfig({
  base: './',
  plugins: [content(), preact()],
});
