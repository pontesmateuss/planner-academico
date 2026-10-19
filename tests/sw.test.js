/* Testa o comportamento do service worker (sw.js) com um navegador simulado:
   instalação, limpeza de caches antigos, "internet primeiro" com cópia de reserva, fontes e pedidos ignorados. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'sw.js'), 'utf8');

const BASE = 'https://exemplo.github.io/planner-academico/';
const CACHE = 'planner-academico-v' + code.match(/const CACHE_VERSION = (\d+);/)[1];
const FONT_CACHE = 'planner-academico-fontes';

function createWorker() {
  const handlers = {};
  const stores = new Map(); // nome do cache -> Map(url -> Response)
  const calls = { skipWaiting: 0, claim: 0, fetches: [], windows: [], opened: [] };
  const net = { online: true, status: 200 };

  const keyOf = (r) => new URL(typeof r === 'string' ? r : r.url, BASE).href;
  const noSearch = (u) => { const x = new URL(u); x.search = ''; return x.href; };

  function store(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }

  const sandbox = {
    Response, Request, URL, Promise, console,
    self: {
      location: { origin: new URL(BASE).origin },
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: () => { calls.skipWaiting++; return Promise.resolve(); },
      clients: {
        claim: () => { calls.claim++; return Promise.resolve(); },
        matchAll: async () => calls.windows,
        openWindow: async (url) => { calls.opened.push(url); }
      }
    },
    fetch: async (r, init) => {
      const url = keyOf(r);
      calls.fetches.push({ url, init });
      if (!net.online) throw new TypeError('sem conexão');
      return new Response('conteúdo de ' + url, { status: net.status });
    },
    caches: {
      open: async (name) => {
        const m = store(name);
        return {
          addAll: async (list) => {
            for (const u of list) {
              const res = await sandbox.fetch(u);
              if (!res.ok) throw new Error('falhou ' + u);
              m.set(keyOf(u), res);
            }
          },
          put: async (r, res) => { m.set(keyOf(r), res); },
          match: async (r) => { const res = m.get(keyOf(r)); return res ? res.clone() : undefined; }
        };
      },
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
      match: async (r, opts = {}) => {
        const wanted = opts.ignoreSearch ? noSearch(keyOf(r)) : keyOf(r);
        for (const m of stores.values()) {
          for (const [k, res] of m) {
            if ((opts.ignoreSearch ? noSearch(k) : k) === wanted) return res.clone();
          }
        }
        return undefined;
      }
    }
  };
  vm.runInNewContext(code, sandbox);

  async function dispatch(type, extra = {}) {
    let waited;
    let responded;
    const ev = { ...extra, waitUntil: (p) => { waited = p; }, respondWith: (p) => { responded = p; } };
    handlers[type](ev);
    if (waited) await waited;
    return { handled: responded !== undefined, response: responded ? await responded : undefined };
  }

  const get = (path, mode = 'cors') => ({ method: 'GET', url: path.startsWith('http') ? path : BASE + path, mode });
  return { dispatch, stores, store, calls, net, get };
}

test('instalação: guarda os arquivos do site e ativa na hora', async () => {
  const w = createWorker();
  await w.dispatch('install');
  const cache = w.store(CACHE);
  [BASE, BASE + 'index.html', BASE + 'js/main.js', BASE + 'manifest.webmanifest'].forEach((u) => {
    assert.ok(cache.has(u), 'faltou guardar ' + u);
  });
  assert.ok(cache.size > 20);
  assert.equal(w.calls.skipWaiting, 1);
});

test('ativação: apaga caches antigos, mantém o atual e o das fontes, e assume as abas abertas', async () => {
  const w = createWorker();
  ['planner-academico-v0', CACHE, FONT_CACHE, 'outro'].forEach((n) => w.store(n));
  await w.dispatch('activate');
  assert.deepEqual([...w.stores.keys()].sort(), [CACHE, FONT_CACHE].sort());
  assert.equal(w.calls.claim, 1);
});

test('com internet: devolve a resposta da rede, confirma com o servidor e guarda uma cópia', async () => {
  const w = createWorker();
  const { handled, response } = await w.dispatch('fetch', { request: w.get('js/main.js') });
  assert.equal(handled, true);
  assert.equal(await response.text(), 'conteúdo de ' + BASE + 'js/main.js');
  assert.equal(w.calls.fetches.at(-1).init.cache, 'no-cache');
  assert.ok(w.store(CACHE).has(BASE + 'js/main.js'));
});

test('sem internet: usa a cópia guardada', async () => {
  const w = createWorker();
  await w.dispatch('fetch', { request: w.get('css/base.css') });
  w.net.online = false;
  const { response } = await w.dispatch('fetch', { request: w.get('css/base.css') });
  assert.equal(await response.text(), 'conteúdo de ' + BASE + 'css/base.css');
});

test('sem internet: ignora a query string ao procurar a cópia', async () => {
  const w = createWorker();
  await w.dispatch('fetch', { request: w.get('js/main.js') });
  w.net.online = false;
  const { response } = await w.dispatch('fetch', { request: w.get('js/main.js?v=2') });
  assert.equal(await response.text(), 'conteúdo de ' + BASE + 'js/main.js');
});

test('sem internet e sem cópia: navegação abre o index.html guardado; outros arquivos dão erro', async () => {
  const w = createWorker();
  await w.dispatch('install');
  w.net.online = false;

  const nav = await w.dispatch('fetch', { request: w.get('qualquer-pagina', 'navigate') });
  assert.equal(await nav.response.text(), 'conteúdo de ' + BASE + 'index.html');

  const other = await w.dispatch('fetch', { request: w.get('js/nao-existe.js') });
  assert.equal(other.response.type, 'error');
});

test('resposta de erro do servidor (404) é repassada e não é guardada', async () => {
  const w = createWorker();
  w.net.status = 404;
  const { response } = await w.dispatch('fetch', { request: w.get('js/sumiu.js') });
  assert.equal(response.status, 404);
  assert.equal(w.store(CACHE).has(BASE + 'js/sumiu.js'), false);
});

test('fontes do Google: usa a cópia guardada mesmo sem internet', async () => {
  const w = createWorker();
  const font = 'https://fonts.gstatic.com/s/lexend/arquivo.woff2';
  await w.dispatch('fetch', { request: w.get(font) });
  assert.ok(w.store(FONT_CACHE).has(font));
  w.net.online = false;
  const { response } = await w.dispatch('fetch', { request: w.get(font) });
  assert.equal(await response.text(), 'conteúdo de ' + font);
});

test('ignora pedidos que não são GET e outros sites', async () => {
  const w = createWorker();
  const post = await w.dispatch('fetch', { request: { method: 'POST', url: BASE + 'js/main.js', mode: 'cors' } });
  assert.equal(post.handled, false);
  const other = await w.dispatch('fetch', { request: w.get('https://exemplo.com/script.js') });
  assert.equal(other.handled, false);
});

test('toque na notificação: fecha o aviso e volta para a aba do Planner, se estiver aberta', async () => {
  const w = createWorker();
  let closed = 0;
  let focused = 0;
  w.calls.windows.push({ focus: async () => { focused++; } });
  await w.dispatch('notificationclick', { notification: { close: () => { closed++; } } });
  assert.equal(closed, 1);
  assert.equal(focused, 1);
  assert.deepEqual(w.calls.opened, []);
});

test('toque na notificação: abre o Planner se não houver nenhuma aba aberta', async () => {
  const w = createWorker();
  await w.dispatch('notificationclick', { notification: { close: () => {} } });
  assert.deepEqual(w.calls.opened, ['./']);
});
