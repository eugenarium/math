// @ts-check
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' — сайт работает и из подкаталога GitHub Pages, и локально.
export default defineConfig({
  base: './',
  plugins: [preact()],
});
