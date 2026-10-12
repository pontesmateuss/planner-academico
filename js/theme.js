/* Tema claro (padrão) e escuro suave, lembrado neste navegador. */

import { THEME_KEY } from './config.js';
import { $ } from './utils.js';

let theme = 'light';

function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  $('tema').textContent = t === 'dark' ? 'Voltar ao tema claro' : 'Tema escuro suave';
  $('tema').setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
}

export function initTheme() {
  try { if (localStorage.getItem(THEME_KEY) === 'dark') theme = 'dark'; } catch (e) { /* ignora */ }
  applyTheme(theme);
  $('tema').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignora */ }
  });
}
