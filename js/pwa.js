/* Registra o service worker (sw.js): o site passa a abrir sem internet e pode ser instalado como app.
   Só funciona em https ou em localhost; fora disso (ou se o navegador não suportar), o site segue normal. */

function canRegister() {
  if (!('serviceWorker' in navigator)) return false;
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  return location.protocol === 'https:' || local;
}

function register() {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem service worker: só não abre offline */ });
}

export function registerServiceWorker() {
  if (!canRegister()) return;
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
