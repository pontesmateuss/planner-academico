/* Tema claro e escuro suave. Segue o tema do aparelho até a pessoa escolher; depois, lembra a escolha neste navegador. */

import { THEME_KEY } from './config.js';
import { $ } from './utils.js';

let theme = 'light';

function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  const label = t === 'dark' ? 'Voltar ao tema claro' : 'Tema escuro suave';
  $('tema').setAttribute('aria-label', label);
  $('tema').title = label;
  $('tema').setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
}

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignora */ }
  if (saved === 'dark' || saved === 'light') theme = saved;
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  applyTheme(theme);
  $('tema').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignora */ }
  });
}
