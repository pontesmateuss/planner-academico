import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, parseBackup, buildBackup, DATA_VERSION } from '../js/validate.js';

const item = { id: 'a1', title: 'Prova', created: 1 };

test('a versão atual é um número inteiro positivo', () => {
  assert.ok(Number.isInteger(DATA_VERSION) && DATA_VERSION >= 1);
});

test('dados sem versão são tratados como versão 0 e chegam à versão atual', () => {
  const r = migrate({ items: [item], updatedAt: 7 });
  assert.equal(r.ok, true);
  assert.equal(r.migrated, true);
  assert.equal(r.from, 0);
  assert.equal(r.data.version, DATA_VERSION);
  assert.equal(r.data.updatedAt, 7);
  assert.deepEqual(r.data.items, [item]);
});

test('lista pura de itens também migra', () => {
  const r = migrate([item]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.items, [item]);
});

test('dados já na versão atual não migram', () => {
  const r = migrate({ version: DATA_VERSION, items: [] });
  assert.equal(r.ok, true);
  assert.equal(r.migrated, false);
});

test('versão mais nova que a atual é recusada com motivo "future"', () => {
  assert.deepEqual(migrate({ version: DATA_VERSION + 1, items: [] }), { ok: false, reason: 'future' });
});

test('versão inválida ou formato sem itens é recusado com motivo "invalid"', () => {
  const bad = [null, 'x', 5, {}, { items: 'x' }, { version: -1, items: [] }, { version: '1', items: [] }, { version: 1.5, items: [] }];
  bad.forEach((b) => assert.deepEqual(migrate(b), { ok: false, reason: 'invalid' }, JSON.stringify(b)));
});

test('cadeia de migrações roda na ordem e não altera o original', () => {
  const calls = [];
  const migrations = {
    0: (d) => { calls.push(0); return { ...d, items: d.items.map((i) => ({ ...i, a: 1 })) }; },
    1: (d) => { calls.push(1); return { ...d, items: d.items.map((i) => ({ ...i, b: 2 })) }; }
  };
  const input = { items: [{ id: 'x' }] };
  const r = migrate(input, migrations, 2);
  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(r.data.items, [{ id: 'x', a: 1, b: 2 }]);
  assert.equal(r.data.version, 2);
  assert.deepEqual(input, { items: [{ id: 'x' }] });
});

test('começa a cadeia na versão dos dados, sem repetir passos antigos', () => {
  const calls = [];
  const migrations = { 0: (d) => { calls.push(0); return d; }, 1: (d) => { calls.push(1); return d; } };
  const r = migrate({ version: 1, items: [] }, migrations, 2);
  assert.deepEqual(calls, [1]);
  assert.equal(r.data.version, 2);
});

test('migração ausente, que dá erro ou que devolve formato errado vira "invalid"', () => {
  assert.deepEqual(migrate({ items: [] }, {}, 1), { ok: false, reason: 'invalid' });
  assert.deepEqual(migrate({ items: [] }, { 0: () => { throw new Error('falhou'); } }, 1), { ok: false, reason: 'invalid' });
  assert.deepEqual(migrate({ items: [] }, { 0: () => ({ semItens: true }) }, 1), { ok: false, reason: 'invalid' });
  assert.deepEqual(migrate({ items: [] }, { 0: () => null }, 1), { ok: false, reason: 'invalid' });
});

test('backup de versão mais nova é recusado com mensagem própria', () => {
  const r = parseBackup(JSON.stringify({ version: DATA_VERSION + 1, items: [item] }));
  assert.equal(r.ok, false);
  assert.match(r.error, /versão mais nova/);
});

test('backup gerado grava a versão atual', () => {
  assert.equal(JSON.parse(buildBackup([], 0)).version, DATA_VERSION);
});

test('backup antigo (lista pura ou sem versão) continua sendo aceito', () => {
  assert.equal(parseBackup(JSON.stringify([item])).ok, true);
  assert.equal(parseBackup(JSON.stringify({ items: [item] })).ok, true);
});
