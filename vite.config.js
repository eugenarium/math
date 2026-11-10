// @ts-check
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
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
  plugins: [
    content(),
    preact(),
    // Офлайн: оболочка, данные и ленивые чанки виджетов кладутся в кэш при первом запуске с сетью.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Матбук',
        short_name: 'Матбук',
        description: 'Интерактивный учебник вузовской математики и статистики',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ttf,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
