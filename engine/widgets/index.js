// Реестр виджетов: модуль загружается динамическим import() при первом показе.
export const loaders = {
  fplot: () => import('./fplot.js'),
  riemann: () => import('./riemann.js'),
};
