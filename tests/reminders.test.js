import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, pruneNotified, sanitizePrefs, runReminders, formatMinutes, LEAD_MIN, GRACE_MIN, MORNING_HOUR } from '../js/reminders.js';

// As datas usam o horário local (como o site), então os testes montam o "agora" também em horário local.
const at = (y, mo, d, hh = 0, mm = 0) => new Date(y, mo - 1, d, hh, mm);
const base = { id: 'a1', title: 'Prova de Cálculo', type: 'prova', subject: 'Cálculo', due: '2026-11-03', time: '08:30', prio: 'normal', notes: '', done: false };

test('formatMinutes', () => {
  assert.equal(formatMinutes(5), '5 min');
  assert.equal(formatMinutes(60), '1 h');
  assert.equal(formatMinutes(90), '1 h 30 min');
});

test('prazo com horário: avisa quando faltam 45 min', () => {
  const r = dueReminders([base], at(2026, 11, 3, 7, 45));
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 't|a1|2026-11-03|08:30');
  assert.equal(r[0].title, 'Prova: Prova de Cálculo');
  assert.equal(r[0].body, 'Em 45 min, às 08:30 · Cálculo');
});

test('janela de aviso: de LEAD_MIN antes até GRACE_MIN depois do horário', () => {
  const due = [2026, 11, 3];
  assert.equal(LEAD_MIN, 60);
  assert.equal(dueReminders([base], at(...due, 7, 30)).length, 1, 'justo 60 min antes: já avisa');
  assert.equal(dueReminders([base], at(...due, 7, 29)).length, 0, '61 min antes: ainda cedo');
  // depois das 8h o resumo do dia também dispara; aqui ele é marcado como já avisado para isolar o aviso com horário
  const semResumo = { 'd|2026-11-03': 1 };
  assert.equal(dueReminders([base], at(...due, 8, 30 + GRACE_MIN), semResumo).length, 1, 'justo 30 min depois: ainda avisa');
  assert.equal(dueReminders([base], at(...due, 9, 1), semResumo).length, 0, '31 min depois: passou');
});

test('texto do aviso: "Agora" e "Começou há"', () => {
  assert.equal(dueReminders([base], at(2026, 11, 3, 8, 30))[0].body, 'Agora, às 08:30 · Cálculo');
  assert.equal(dueReminders([base], at(2026, 11, 3, 8, 40))[0].body, 'Começou há 10 min, às 08:30 · Cálculo');
  assert.equal(dueReminders([{ ...base, time: '10:00', subject: '' }], at(2026, 11, 3, 9, 0))[0].body, 'Em 1 h, às 10:00');
});

test('não avisa o que já foi avisado, nem prazos de outro dia', () => {
  const now = at(2026, 11, 3, 7, 45);
  assert.equal(dueReminders([base], now, { 't|a1|2026-11-03|08:30': 1 }).length, 0);
  assert.equal(dueReminders([{ ...base, due: '2026-11-04' }], now).length, 0);
});

test('ignora concluídos, exemplos, sem prazo e itens inválidos', () => {
  const now = at(2026, 11, 3, 7, 45);
  const items = [{ ...base, id: 'b', done: true }, { ...base, id: 'c', example: true }, { ...base, id: 'd', due: '' }, null];
  assert.deepEqual(dueReminders(items, now), []);
});

test('vários avisos saem em ordem de horário', () => {
  const items = [{ ...base, id: 'tarde', time: '08:50' }, { ...base, id: 'cedo', time: '08:10' }];
  assert.deepEqual(dueReminders(items, at(2026, 11, 3, 7, 50)).map((r) => r.key.split('|')[1]), ['cedo', 'tarde']);
});

test('resumo do dia: depois das 8h, com o que vence hoje e o que está atrasado', () => {
  const items = [
    { ...base, id: 'h1', title: 'Relatório', time: '', due: '2026-11-03' },
    { ...base, id: 'l1', title: 'Lista 3', time: '', due: '2026-11-01' },
    { ...base, id: 'l2', title: 'Lista 4', time: '', due: '2026-10-30' },
    { ...base, id: 'f1', title: 'Futuro', time: '', due: '2026-11-20' }
  ];
  const r = dueReminders(items, at(2026, 11, 3, MORNING_HOUR, 0));
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'd|2026-11-03');
  assert.equal(r[0].title, 'Planner: resumo do dia');
  assert.equal(r[0].body, 'Hoje: Relatório. 2 atrasados.');
});

test('resumo do dia: não sai antes das 8h, não repete e não sai sem nada para dizer', () => {
  const items = [{ ...base, id: 'h1', title: 'Relatório', time: '', due: '2026-11-03' }];
  assert.equal(dueReminders(items, at(2026, 11, 3, 7, 59)).length, 0);
  assert.equal(dueReminders(items, at(2026, 11, 3, 8, 0), { 'd|2026-11-03': 1 }).length, 0);
  assert.equal(dueReminders([{ ...items[0], due: '2026-11-20' }], at(2026, 11, 3, 9, 0)).length, 0);
});

test('resumo do dia: singular, plural e "e mais N"', () => {
  const mk = (n, due) => Array.from({ length: n }, (_, i) => ({ ...base, id: due + i, title: 'T' + (i + 1), time: '', due }));
  assert.equal(dueReminders(mk(1, '2026-11-01'), at(2026, 11, 3, 9))[0].body, '1 atrasado.');
  assert.equal(dueReminders(mk(5, '2026-11-03'), at(2026, 11, 3, 9))[0].body, 'Hoje: T1; T2; T3 e mais 2.');
});

test('pruneNotified esquece avisos antigos e entradas inválidas', () => {
  const now = at(2026, 11, 10, 12);
  const old = now.getTime() - 8 * 86400000;
  const recent = now.getTime() - 2 * 86400000;
  assert.deepEqual(pruneNotified({ velho: old, novo: recent, ruim: 'x' }, now), { novo: recent });
  assert.deepEqual(pruneNotified(null, now), {});
});

test('sanitizePrefs aceita lixo e devolve preferências seguras', () => {
  assert.deepEqual(sanitizePrefs(null), { enabled: false, notified: {} });
  assert.deepEqual(sanitizePrefs('x'), { enabled: false, notified: {} });
  assert.deepEqual(sanitizePrefs({ enabled: 'sim', notified: [1, 2] }), { enabled: false, notified: {} });
  assert.deepEqual(sanitizePrefs({ enabled: true, notified: { a: 5, b: 'x', c: NaN } }), { enabled: true, notified: { a: 5 } });
});

test('runReminders: desligado, não mostra nada', async () => {
  let shown = 0;
  const prefs = { enabled: false, notified: {} };
  const out = await runReminders([base], at(2026, 11, 3, 7, 45), prefs, async () => { shown++; return true; });
  assert.equal(shown, 0);
  assert.equal(out, prefs);
});

test('runReminders: mostra, marca como avisado e não repete na verificação seguinte', async () => {
  const shown = [];
  const show = async (r) => { shown.push(r.key); return true; };
  const now = at(2026, 11, 3, 7, 45);
  let prefs = { enabled: true, notified: {} };
  prefs = await runReminders([base], now, prefs, show);
  assert.deepEqual(shown, ['t|a1|2026-11-03|08:30']);
  assert.equal(prefs.notified['t|a1|2026-11-03|08:30'], now.getTime());
  prefs = await runReminders([base], at(2026, 11, 3, 7, 46), prefs, show);
  assert.equal(shown.length, 1);
});

test('runReminders: se mostrar falhar, não marca e tenta de novo na próxima vez', async () => {
  let ok = false;
  const show = async () => ok;
  let prefs = { enabled: true, notified: {} };
  prefs = await runReminders([base], at(2026, 11, 3, 7, 45), prefs, show);
  assert.deepEqual(prefs.notified, {});
  ok = true;
  prefs = await runReminders([base], at(2026, 11, 3, 7, 46), prefs, show);
  assert.equal(Object.keys(prefs.notified).length, 1);
});
