/* Aviso rápido no rodapé, com botão opcional de desfazer. */

import { TOAST_MS } from './config.js';
import { $, el } from './utils.js';

let timer = null;

export function hideToast() {
  $('toast').hidden = true;
  clearTimeout(timer);
}

export function toast(msg, undoFn) {
  const t = $('toast');
  t.replaceChildren();
  t.appendChild(el('span', '', msg));
  if (undoFn) {
    const b = el('button', 'btn small', 'Desfazer');
    b.type = 'button';
    b.addEventListener('click', () => { undoFn(); hideToast(); });
    t.appendChild(b);
  }
  t.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(hideToast, TOAST_MS);
}
