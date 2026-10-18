/* Exporta os prazos para o formato de agenda .ics (Google Agenda, Calendário da Apple, Outlook).
   Funções puras, sem acesso à tela: podem ser testadas com `node --test`.

   Cada prazo pendente vira um evento com lembretes:
   - sem horário: evento de dia inteiro, com lembrete na véspera às 9h e no dia às 9h;
   - com horário: evento de 1 hora, com lembrete 1 dia antes e 1 hora antes.
   O identificador (UID) de cada evento é o id do item, então exportar de novo costuma atualizar
   os mesmos eventos na agenda em vez de duplicar. */

import { TYPES } from './config.js';
import { compareItems } from './dates.js';

const PRODID = '-//Planner Academico//PT-BR//';
const PRIORITY = { alta: 1, normal: 5, baixa: 9 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad = (n) => String(n).padStart(2, '0');

/** Escapa texto como o formato exige: barra, ponto e vírgula, vírgula e quebras de linha. */
export function escapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Quebra linhas longas em 75 bytes (UTF-8), sem nunca cortar um caractere no meio. */
export function foldLine(line) {
  const enc = new TextEncoder();
  const parts = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // as linhas de continuação começam com um espaço
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/** Itens que vão para a agenda: pendentes, com prazo válido e que não são exemplos. */
export function exportableItems(items) {
  return items
    .filter((i) => i && !i.done && !i.example && typeof i.due === 'string' && DATE_RE.test(i.due))
    .slice()
    .sort(compareItems);
}

function dateValue(iso) {
  return iso.replace(/-/g, '');
}

/** Soma dias a uma data AAAA-MM-DD, sem depender de fuso nem de horário de verão. */
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate());
}

/** Data e hora "flutuantes" (sem fuso): a agenda mostra no horário de quem abre o arquivo. */
function floating(t) {
  return t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()) +
    'T' + pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + '00';
}

function alarm(title, trigger) {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapeText(title), 'TRIGGER:' + trigger, 'END:VALARM'];
}

function eventLines(item, stamp) {
  const label = TYPES[item.type] || TYPES.atividade;
  const title = label + ': ' + item.title;
  const timed = typeof item.time === 'string' && TIME_RE.test(item.time);

  const lines = ['BEGIN:VEVENT', 'UID:' + item.id + '@planner-academico', 'DTSTAMP:' + stamp];
  if (timed) {
    const [y, m, d] = item.due.split('-').map(Number);
    const [hh, mm] = item.time.split(':').map(Number);
    const start = Date.UTC(y, m - 1, d, hh, mm);
    lines.push('DTSTART:' + floating(new Date(start)), 'DTEND:' + floating(new Date(start + 3600000)));
  } else {
    lines.push('DTSTART;VALUE=DATE:' + dateValue(item.due), 'DTEND;VALUE=DATE:' + addDays(item.due, 1));
  }

  lines.push('SUMMARY:' + escapeText(title));
  const description = [];
  if (item.subject) description.push('Matéria: ' + item.subject);
  if (item.prio === 'alta') description.push('Prioridade alta');
  if (item.notes) description.push(item.notes);
  if (description.length) lines.push('DESCRIPTION:' + escapeText(description.join('\n')));
  lines.push('CATEGORIES:' + escapeText(label), 'PRIORITY:' + (PRIORITY[item.prio] || 5));

  if (timed) lines.push(...alarm(title, '-P1D'), ...alarm(title, '-PT1H'));
  else lines.push(...alarm(title, '-PT15H'), ...alarm(title, 'PT9H'));

  lines.push('END:VEVENT');
  return lines;
}

/** Monta o texto do arquivo .ics (linhas separadas por CRLF, como o formato exige). */
export function buildIcs(items, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:' + PRODID,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Planner Acadêmico'
  ];
  exportableItems(items).forEach((item) => lines.push(...eventLines(item, stamp)));
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
