/* Service worker: deixa o site abrir sem internet e permite instalá-lo como app.

   - Na instalação, guarda uma cópia de todos os arquivos do site (PRECACHE).
   - Depois, para os arquivos do próprio site: tenta a internet primeiro (assim você sempre vê a versão
     mais nova) e, se não houver conexão, usa a cópia guardada.
   - Fontes do Google: usa a cópia guardada e atualiza em segundo plano.

   Ao criar, renomear ou apagar um arquivo do site, atualize PRECACHE e some 1 a CACHE_VERSION.
   O teste tests/estrutura.test.js avisa se a lista ficar diferente dos arquivos que existem. */

const CACHE_VERSION = 3;
const CACHE = 'planner-academico-v' + CACHE_VERSION;
const FONT_CACHE = 'planner-academico-fontes';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'js/main.js',
  'js/actions.js',
  'js/account.js',
  'js/agenda.js',
  'js/backup.js',
  'js/config.js',
  'js/dates.js',
  'js/ics.js',
  'js/pwa.js',
  'js/remote.js',
  'js/reminders.js',
  'js/render.js',
  'js/seed.js',
  'js/selectors.js',
  'js/state.js',
  'js/storage.js',
  'js/theme.js',
  'js/toast.js',
  'js/utils.js',
  'js/validate.js',
  'vendor/supabase-js-2.118.0.umd.js',
  'assets/img/logo-horizontal.png',
  'assets/img/logo-icone.png',
  'assets/img/icon-192.png',
  'assets/img/icon-512.png',
  'assets/img/icon-maskable-512.png',
  'assets/img/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE && n !== FONT_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req));
  }
});

// Ao tocar numa notificação de prazo: volta para o Planner se ele já estiver aberto, ou abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('./');
    })
  );
});

async function networkFirst(req) {
  try {
    // "no-cache" faz o navegador confirmar com o servidor, em vez de usar uma cópia de até 10 minutos.
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok && res.status === 200) {
      const cache = await caches.open(CACHE);
      await cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const home = await caches.match('index.html');
      if (home) return home;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit || (await update) || Response.error();
}
