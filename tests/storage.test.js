/* Testa storage.js com um navegador simulado (localStorage e DOM mínimos). */

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

const { loadLocal, persist, getCorruptRaw } = await import('../js/storage.js');
const { state } = await import('../js/state.js');
const { STORAGE_KEY, STATUS_TEXT } = await import('../js/config.js');
const { DATA_VERSION } = await import('../js/validate.js');

const BEFORE_KEY = STORAGE_KEY + ':antes-da-migracao';

function reset() {
  store.clear();
  failWrites = false;
  status.textContent = '';
  state.items = [];
  state.updatedAt = 0;
  state.examples = false;
}

test('JSON quebrado: não carrega e guarda uma cópia do texto original', () => {
  reset();
  store.set(STORAGE_KEY, '{quebrado');
  assert.equal(loadLocal(), false);
  assert.equal(getCorruptRaw(), '{quebrado');
});

test('itens parcialmente inválidos: carrega os bons e guarda o original', () => {
  reset();
  const raw = JSON.stringify({ version: DATA_VERSION, updatedAt: 5, items: [{ id: 'a', title: 'ok' }, { title: '' }] });
  store.set(STORAGE_KEY, raw);
  assert.equal(loadLocal(), true);
  assert.equal(state.items.length, 1);
  assert.equal(getCorruptRaw(), raw);
});

test('dados bons na versão atual: sem cópia ilegível e sem cópia de migração', () => {
  reset();
  store.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, updatedAt: 9, items: [{ id: 'b', title: 'bom' }] }));
  assert.equal(loadLocal(), true);
  assert.equal(getCorruptRaw(), null);
  assert.equal(store.has(BEFORE_KEY), false);
});

test('dados antigos sem versão: migra, guarda cópia do original e regrava com a versão atual', () => {
  reset();
  const raw = JSON.stringify({ updatedAt: 3, examples: false, items: [{ id: 'c', title: 'antigo' }] });
  store.set(STORAGE_KEY, raw);
  assert.equal(loadLocal(), true);
  assert.equal(state.items.length, 1);
  assert.equal(state.updatedAt, 3);
  assert.equal(store.get(BEFORE_KEY), raw);
  assert.equal(JSON.parse(store.get(STORAGE_KEY)).version, DATA_VERSION);
});

test('falha ao salvar avisa na tela; salvar normal grava com versão', () => {
  reset();
  failWrites = true;
  persist();
  assert.match(status.textContent, /backup/i);

  failWrites = false;
  state.items = [{ id: 'd', title: 'novo' }];
  persist();
  assert.equal(status.textContent, STATUS_TEXT.local);
  const saved = JSON.parse(store.get(STORAGE_KEY));
  assert.equal(saved.version, DATA_VERSION);
  assert.equal(saved.items.length, 1);
});

// Este teste fica por último: depois dele o storage.js fica travado, como acontece no navegador.
test('dados de versão mais nova: não carrega, avisa, guarda cópia e nunca sobrescreve', () => {
  reset();
  const raw = JSON.stringify({ version: DATA_VERSION + 1, updatedAt: 1, items: [{ id: 'e', title: 'futuro' }] });
  store.set(STORAGE_KEY, raw);
  assert.equal(loadLocal(), false);
  assert.match(status.textContent, /versão mais nova/);
  assert.equal(getCorruptRaw(), raw);

  state.items = [{ id: 'f', title: 'exemplo' }];
  persist();
  assert.equal(store.get(STORAGE_KEY), raw, 'o dado original não pode ser sobrescrito');
  assert.match(status.textContent, /versão mais nova/);
});
