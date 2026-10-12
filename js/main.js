/* Ponto de entrada. Só liga os módulos, na ordem certa; a lógica fica em cada módulo.

   Dependências (cada seta é um import, nunca o contrário, então não há ciclos):
   config, utils  <-  dates  <-  state  <-  selectors, seed, storage  <-  render, toast  <-  actions  <-  main
*/

import { replaceData } from './state.js';
import { seedItems } from './seed.js';
import { loadLocal, setStatus, initRemote, pull, setRemoteChangeHandler } from './storage.js';
import { renderAll, dayChanged } from './render.js';
import { bindEvents } from './actions.js';
import { initTheme } from './theme.js';

initTheme();

if (loadLocal()) {
  setStatus('local');
} else {
  replaceData({ items: seedItems(), updatedAt: 0 });
}

setRemoteChangeHandler(renderAll);
bindEvents();
renderAll();
initRemote();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderAll();
    pull();
  }
});

setInterval(() => {
  if (dayChanged()) renderAll();
}, 60000);
