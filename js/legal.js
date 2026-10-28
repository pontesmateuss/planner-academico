/* Páginas de documentos legais: usa o tema escolhido no Planner (claro ou escuro suave).
   Sem escolha salva, segue o tema do aparelho, igual ao Planner. */

import { THEME_KEY } from './config.js';

let saved = null;
try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* sem acesso ao armazenamento: segue o aparelho */ }
const dark = saved === 'dark' || (saved !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
if (dark) document.documentElement.setAttribute('data-theme', 'dark');
