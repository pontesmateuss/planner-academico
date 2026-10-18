import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, exportableItems, escapeText, foldLine } from '../js/ics.js';

const NOW = new Date('2026-10-18T17:00:00Z');
const base = { id: 'a1', title: 'Entregar relatório', type: 'trabalho', subject: 'Física', due: '2026-11-03', time: '', prio: 'normal', notes: '', done: false, doneAt: null, created: 1 };

const unfold = (text) => text.replace(/\r\n /g, '');
const linesOf = (text) => unfold(text).split('\r\n').filter(Boolean);

test('só exporta itens pendentes, com prazo válido e que não são exemplos', () => {
  const items = [
    base,
    { ...base, id: 'b', done: true },
    { ...base, id: 'c', due: '' },
    { ...base, id: 'd', example: true },
    { ...base, id: 'e', due: 'amanhã' },
    null
  ];
  assert.deepEqual(exportableItems(items).map((i) => i.id), ['a1']);
});

test('os itens saem ordenados por prazo e horário', () => {
  const items = [
    { ...base, id: 'tarde', due: '2026-11-05' },
    { ...base, id: 'cedo', due: '2026-11-01' },
    { ...base, id: 'hora', due: '2026-11-01', time: '08:00' }
  ];
  assert.deepEqual(exportableItems(items).map((i) => i.id), ['hora', 'cedo', 'tarde']);
});

test('estrutura do arquivo: calendário válido, só com CRLF', () => {
  const text = buildIcs([base], NOW);
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.equal(/(^|[^\r])\n/.test(text), false, 'há quebra de linha sem CR');
  assert.equal(text.match(/BEGIN:VEVENT/g).length, 1);
  assert.equal(text.match(/END:VEVENT/g).length, 1);
});

test('sem itens: calendário vazio, mas válido', () => {
  const text = buildIcs([], NOW);
  assert.equal(text.includes('BEGIN:VEVENT'), false);
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
});

test('prazo sem horário: evento de dia inteiro e dois lembretes (véspera e dia, às 9h)', () => {
  const lines = linesOf(buildIcs([base], NOW));
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20261103'));
  assert.ok(lines.includes('DTEND;VALUE=DATE:20261104'));
  assert.ok(lines.includes('TRIGGER:-PT15H'));
  assert.ok(lines.includes('TRIGGER:PT9H'));
  assert.equal(lines.filter((l) => l === 'BEGIN:VALARM').length, 2);
});

test('dia inteiro: o fim vira o dia seguinte também na virada de mês e de ano', () => {
  assert.ok(linesOf(buildIcs([{ ...base, due: '2026-12-31' }], NOW)).includes('DTEND;VALUE=DATE:20270101'));
  assert.ok(linesOf(buildIcs([{ ...base, due: '2028-02-28' }], NOW)).includes('DTEND;VALUE=DATE:20280229'));
});

test('prazo com horário: evento de 1 hora e lembretes 1 dia e 1 hora antes', () => {
  const lines = linesOf(buildIcs([{ ...base, time: '08:30' }], NOW));
  assert.ok(lines.includes('DTSTART:20261103T083000'));
  assert.ok(lines.includes('DTEND:20261103T093000'));
  assert.ok(lines.includes('TRIGGER:-P1D'));
  assert.ok(lines.includes('TRIGGER:-PT1H'));
});

test('horário no fim do dia termina no dia seguinte', () => {
  const lines = linesOf(buildIcs([{ ...base, time: '23:30' }], NOW));
  assert.ok(lines.includes('DTSTART:20261103T233000'));
  assert.ok(lines.includes('DTEND:20261104T003000'));
});

test('identificador estável e carimbo de data vindo do relógio informado', () => {
  const lines = linesOf(buildIcs([base], NOW));
  assert.ok(lines.includes('UID:a1@planner-academico'));
  assert.ok(lines.includes('DTSTAMP:20261018T170000Z'));
  assert.deepEqual(buildIcs([base], NOW), buildIcs([base], NOW));
});

test('título com o tipo, matéria e observações na descrição, prioridade mapeada', () => {
  const lines = linesOf(buildIcs([{ ...base, prio: 'alta', notes: 'Levar o gráfico' }], NOW));
  assert.ok(lines.includes('SUMMARY:Trabalho: Entregar relatório'));
  assert.ok(lines.includes('DESCRIPTION:Matéria: Física\\nPrioridade alta\\nLevar o gráfico'));
  assert.ok(lines.includes('CATEGORIES:Trabalho'));
  assert.ok(lines.includes('PRIORITY:1'));
  assert.ok(linesOf(buildIcs([{ ...base, prio: 'baixa' }], NOW)).includes('PRIORITY:9'));
});

test('escapa barra, ponto e vírgula, vírgula e quebra de linha', () => {
  assert.equal(escapeText('a, b; c\\d\ne'), 'a\\, b\\; c\\\\d\\ne');
  const lines = linesOf(buildIcs([{ ...base, title: 'Cálculo 1, lista 2; bloco A' }], NOW));
  assert.ok(lines.includes('SUMMARY:Trabalho: Cálculo 1\\, lista 2\\; bloco A'));
});

test('linhas longas são quebradas em até 75 bytes, sem cortar caracteres no meio', () => {
  const title = 'Relatório de Física Experimental: análise de incerteza, propagação de erros e conclusão 📚 ' + 'ção '.repeat(30);
  const text = buildIcs([{ ...base, title, notes: 'ação '.repeat(80) }], NOW);
  const enc = new TextEncoder();
  const strict = new TextDecoder('utf-8', { fatal: true });
  text.split('\r\n').filter(Boolean).forEach((physical) => {
    assert.ok(enc.encode(physical).length <= 75, 'linha com mais de 75 bytes: ' + physical.slice(0, 40));
    strict.decode(enc.encode(physical)); // lança erro se algum caractere foi cortado
  });
  assert.ok(linesOf(text).includes('SUMMARY:Trabalho: ' + escapeText(title)), 'ao juntar as linhas, o texto original volta inteiro');
});

test('foldLine não mexe em linhas curtas', () => {
  assert.equal(foldLine('SUMMARY:curto'), 'SUMMARY:curto');
});
