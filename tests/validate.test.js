import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeItem, sanitizeItems, buildBackup, parseBackup, LIMITS } from '../js/validate.js';

const base = { id: 'a1', title: 'Prova de Cálculo', type: 'prova', subject: 'Cálculo', due: '2026-11-03', time: '08:00', prio: 'alta', notes: 'Capítulos 1 a 4', done: false, doneAt: null, created: 1700000000000 };

test('item válido passa sem mudanças', () => {
  assert.deepEqual(sanitizeItem(base), base);
});

test('item sem título é descartado', () => {
  assert.equal(sanitizeItem({ ...base, title: '   ' }), null);
  assert.equal(sanitizeItem(null), null);
  assert.equal(sanitizeItem('texto'), null);
  assert.equal(sanitizeItem([]), null);
});

test('data inválida vira vazio e leva o horário junto', () => {
  const it = sanitizeItem({ ...base, due: '2026-02-30' });
  assert.equal(it.due, '');
  assert.equal(it.time, '');
});

test('horário inválido vira vazio', () => {
  assert.equal(sanitizeItem({ ...base, time: '25:99' }).time, '');
});

test('prioridade e tipo inválidos recebem o padrão', () => {
  const it = sanitizeItem({ ...base, prio: 'urgente', type: 'x y<script>' });
  assert.equal(it.prio, 'normal');
  assert.equal(it.type, 'atividade');
});

test('textos longos são cortados no limite', () => {
  const it = sanitizeItem({ ...base, title: 'a'.repeat(500), notes: 'b'.repeat(2000) });
  assert.equal(it.title.length, LIMITS.title);
  assert.equal(it.notes.length, LIMITS.notes);
});

test('id ausente ou estranho ganha um novo', () => {
  assert.match(sanitizeItem({ ...base, id: undefined }).id, /^[\w-]+$/);
  assert.match(sanitizeItem({ ...base, id: '"><img>' }).id, /^[\w-]+$/);
});

test('campos desconhecidos são removidos', () => {
  assert.equal('hack' in sanitizeItem({ ...base, hack: 1 }), false);
});

test('item concluído ganha doneAt; item aberto fica com null', () => {
  assert.equal(sanitizeItem({ ...base, done: true }).done, true);
  assert.ok(sanitizeItem({ ...base, done: true, doneAt: undefined }).doneAt > 0);
  assert.equal(sanitizeItem({ ...base, done: false, doneAt: 123 }).doneAt, null);
});

test('flag de exemplo é preservada', () => {
  assert.equal(sanitizeItem({ ...base, example: true }).example, true);
  assert.equal('example' in sanitizeItem(base), false);
});

test('sanitizeItems descarta inválidos e ids repetidos e conta', () => {
  const r = sanitizeItems([base, base, { title: '' }, null, { ...base, id: 'a2' }]);
  assert.equal(r.items.length, 2);
  assert.equal(r.skipped, 3);
  assert.deepEqual(sanitizeItems('x'), { items: [], skipped: 0 });
});

test('backup gerado pode ser lido de volta', () => {
  const text = buildBackup([base], 42, new Date('2026-10-18T12:00:00Z'));
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.items, [base]);
  assert.equal(r.skipped, 0);
  assert.equal(JSON.parse(text).exportedAt, '2026-10-18T12:00:00.000Z');
});

test('parseBackup aceita lista pura e backup vazio', () => {
  assert.equal(parseBackup(JSON.stringify([base])).ok, true);
  const empty = parseBackup(JSON.stringify({ items: [] }));
  assert.equal(empty.ok, true);
  assert.equal(empty.items.length, 0);
});

test('parseBackup recusa lixo com mensagem clara', () => {
  assert.equal(parseBackup('não é json').ok, false);
  assert.equal(parseBackup('{"foo":1}').ok, false);
  assert.equal(parseBackup('{"items":[{"title":""},1,null]}').ok, false);
  assert.equal(parseBackup(JSON.stringify({ items: new Array(LIMITS.items + 1).fill(base) })).ok, false);
  assert.match(parseBackup('não é json').error, /backup válido/);
});
