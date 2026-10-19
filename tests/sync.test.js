/* Testa a sincronização de storage.js com um navegador e uma conta simulados. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
let failWrites = false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (failWrites) throw new Error('sem espaço');
    store.set(k, String(v));
  }
};
const status = { textContent: '' };
globalThis.document = { getElementById: (id) => (id === 'status' ? status : null) };

const { persist, pull, connectRemote, disconnectRemote, getBeforeSyncRaw, setRemoteChangeHandler } = await import('../js/storage.js');
const { state } = await import('../js/state.js');
const { STORAGE_KEY, STATUS_TEXT, SAVE_DELAY_MS } = await import('../js/config.js');
const { DATA_VERSION, parseBackup } = await import('../js/validate.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const item = (id, extra = {}) => ({ id, title: 'Item ' + id, type: 'atividade', subject: '', due: '', time: '', prio: 'normal', notes: '', done: false, doneAt: null, created: 1, ...extra });

/** Conta de mentira. `doc` é o documento guardado (ou null). */
function fakeRef(doc, { failGet = false, failSet = false } = {}) {
  const ref = {
    doc,
    sets: [],
    gets: 0,
    async get() {
      ref.gets++;
      if (failGet) throw new Error('rede');
      return { exists: ref.doc != null, data: () => ref.doc };
    },
    async set(payload) {
      if (failSet) throw new Error('rede');
      ref.sets.push(payload);
      ref.doc = payload;
    }
  };
  return ref;
}

let remoteChanges = 0;
setRemoteChangeHandler(() => { remoteChanges++; });

function reset(items, updatedAt) {
  disconnectRemote();
  store.clear();
  failWrites = false;
  status.textContent = '';
  remoteChanges = 0;
  state.items = items;
  state.updatedAt = updatedAt;
  state.examples = false;
}

test('conta mais nova vence: aplica na tela, guarda no navegador e copia o que era só deste aparelho', async () => {
  reset([item('local')], 100);
  const ref = fakeRef({ version: DATA_VERSION, items: [item('conta')], updatedAt: 200 });
  const r = await connectRemote(ref);
  assert.deepEqual(r, { action: 'applied-remote', keptCopy: true });
  assert.deepEqual(state.items.map((i) => i.id), ['conta']);
  assert.equal(state.updatedAt, 200);
  assert.equal(remoteChanges, 1);
  assert.equal(JSON.parse(store.get(STORAGE_KEY)).items[0].id, 'conta');
  assert.equal(status.textContent, STATUS_TEXT.synced);
  assert.equal(ref.sets.length, 0, 'não deve reenviar o que acabou de receber');

  const copy = parseBackup(getBeforeSyncRaw());
  assert.equal(copy.ok, true, 'a cópia precisa poder ser restaurada pela seção Backup');
  assert.deepEqual(copy.items.map((i) => i.id), ['local']);
  assert.equal(JSON.parse(getBeforeSyncRaw()).replaced, 'aparelho');
});

test('aparelho só com exemplos: a conta vence sem guardar cópia', async () => {
  reset([item('ex', { example: true })], 0);
  const r = await connectRemote(fakeRef({ version: DATA_VERSION, items: [item('conta')], updatedAt: 50 }));
  assert.deepEqual(r, { action: 'applied-remote', keptCopy: false });
  assert.equal(getBeforeSyncRaw(), null);
  assert.deepEqual(state.items.map((i) => i.id), ['conta']);
});

test('aparelho mais novo vence: envia para a conta e copia o que estava na conta', async () => {
  reset([item('local')], 300);
  const ref = fakeRef({ version: DATA_VERSION, items: [item('conta')], updatedAt: 100 });
  const r = await connectRemote(ref);
  assert.deepEqual(r, { action: 'pushed-local', keptCopy: true });
  await wait(20);
  assert.equal(ref.sets.length, 1);
  assert.deepEqual(ref.doc.items.map((i) => i.id), ['local']);
  assert.equal(ref.doc.version, DATA_VERSION);
  assert.equal(JSON.parse(getBeforeSyncRaw()).replaced, 'conta');
  assert.deepEqual(parseBackup(getBeforeSyncRaw()).items.map((i) => i.id), ['conta']);
  assert.equal(remoteChanges, 0);
});

test('conta vazia: envia o que há no aparelho; aparelho recém-criado (updatedAt 0) não envia nada', async () => {
  reset([item('a')], 10);
  const ref = fakeRef(null);
  assert.deepEqual(await connectRemote(ref), { action: 'pushed-local', keptCopy: false });
  await wait(20);
  assert.equal(ref.sets.length, 1);

  reset([item('ex', { example: true })], 0);
  const ref2 = fakeRef(null);
  assert.deepEqual(await connectRemote(ref2), { action: 'in-sync', keptCopy: false });
  await wait(20);
  assert.equal(ref2.sets.length, 0);
});

test('mesmo horário e mesmos itens: nada a fazer', async () => {
  reset([item('a')], 100);
  const ref = fakeRef({ version: DATA_VERSION, items: [item('a')], updatedAt: 100 });
  assert.deepEqual(await connectRemote(ref), { action: 'in-sync', keptCopy: false });
  assert.equal(ref.sets.length, 0);
  assert.equal(getBeforeSyncRaw(), null);
});

test('itens iguais com horários diferentes: sem cópia de segurança desnecessária', async () => {
  reset([item('a')], 100);
  const r = await connectRemote(fakeRef({ version: DATA_VERSION, items: [item('a')], updatedAt: 200 }));
  assert.equal(r.action, 'applied-remote');
  assert.equal(r.keptCopy, false);
  assert.equal(getBeforeSyncRaw(), null);
});

test('conta com versão mais nova que a do app: não aplica, não sobrescreve e avisa', async () => {
  reset([item('local')], 999);
  const ref = fakeRef({ version: DATA_VERSION + 1, items: [item('futuro')], updatedAt: 1 });
  const r = await connectRemote(ref);
  assert.equal(r.action, 'locked');
  assert.match(status.textContent, /versão mais nova/);
  await wait(20);
  assert.equal(ref.sets.length, 0);
  assert.deepEqual(state.items.map((i) => i.id), ['local']);
});

test('sem rede ao ler: avisa o erro e não mexe nos itens', async () => {
  reset([item('local')], 100);
  const r = await connectRemote(fakeRef(null, { failGet: true }));
  assert.equal(r.action, 'error');
  assert.equal(status.textContent, STATUS_TEXT.error);
  assert.deepEqual(state.items.map((i) => i.id), ['local']);
});

test('editar com conta ligada: salva no navegador na hora e na conta depois do atraso', async () => {
  reset([item('a')], 100);
  const ref = fakeRef({ version: DATA_VERSION, items: [item('a')], updatedAt: 100 });
  await connectRemote(ref);
  state.items.push(item('b'));
  persist();
  assert.equal(JSON.parse(store.get(STORAGE_KEY)).items.length, 2, 'navegador salva sem esperar');
  assert.equal(ref.sets.length, 0, 'conta espera o atraso');
  await wait(SAVE_DELAY_MS + 80);
  assert.equal(ref.sets.length, 1);
  assert.deepEqual(ref.doc.items.map((i) => i.id), ['a', 'b']);
  assert.equal(status.textContent, STATUS_TEXT.synced);
});

test('várias edições seguidas viram um só envio', async () => {
  reset([item('a')], 100);
  const ref = fakeRef({ version: DATA_VERSION, items: [item('a')], updatedAt: 100 });
  await connectRemote(ref);
  for (let i = 0; i < 5; i++) { state.items.push(item('n' + i)); persist(); }
  await wait(SAVE_DELAY_MS + 80);
  assert.equal(ref.sets.length, 1);
  assert.equal(ref.doc.items.length, 6);
});

test('falha ao enviar: mostra o erro, mas o item continua salvo no navegador', async () => {
  reset([item('a')], 100);
  const ref = fakeRef({ version: DATA_VERSION, items: [item('a')], updatedAt: 100 }, { failSet: true });
  await connectRemote(ref);
  state.items.push(item('b'));
  persist();
  await wait(SAVE_DELAY_MS + 80);
  assert.equal(status.textContent, STATUS_TEXT.error);
  assert.equal(JSON.parse(store.get(STORAGE_KEY)).items.length, 2);
});

test('sair da conta: para de enviar, volta ao "salvo neste navegador" e mantém os itens', async () => {
  reset([item('a')], 100);
  const ref = fakeRef({ version: DATA_VERSION, items: [item('a')], updatedAt: 100 });
  await connectRemote(ref);
  state.items.push(item('b'));
  persist(); // envio agendado
  disconnectRemote();
  await wait(SAVE_DELAY_MS + 80);
  assert.equal(ref.sets.length, 0, 'o envio agendado foi cancelado');
  assert.equal(status.textContent, STATUS_TEXT.local);
  state.items.push(item('c'));
  persist();
  await wait(SAVE_DELAY_MS + 80);
  assert.equal(ref.sets.length, 0);
  assert.equal(JSON.parse(store.get(STORAGE_KEY)).items.length, 3);
});

test('pull sem conta ligada não faz nada', async () => {
  reset([item('a')], 1);
  assert.deepEqual(await pull(), { action: 'skipped', keptCopy: false });
});
