// Реестр виджетов: модуль загружается динамическим import() при первом показе.
export const loaders = {
  fplot: () => import('./fplot.js'),
  riemann: () => import('./riemann.js'),
  lin2: () => import('./lin2.js'),
  dist: () => import('./dist.js'),
  ci: () => import('./ci.js'),
  matrix: () => import('./matrix.js'),
};
