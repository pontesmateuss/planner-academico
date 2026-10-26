/* Páginas de documentos legais: aplica o tema que a pessoa escolheu no Planner (claro ou escuro suave). */

import { THEME_KEY } from './config.js';

try {
  if (localStorage.getItem(THEME_KEY) === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
} catch (e) { /* sem acesso ao armazenamento: fica no tema claro */ }
