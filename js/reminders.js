/* Avisos de prazo com o site aberto (em uma aba ou instalado como app).
   Aqui fica só a lógica, sem acesso à tela: decide O QUE avisar e lembra o que já foi avisado.
   Quem mostra a notificação (e pede permissão) é o agenda.js.

   Regras:
   - prazo com horário: avisa quando faltar LEAD_MIN minutos ou menos, até GRACE_MIN minutos depois do horário;
   - resumo do dia: uma vez por dia, a partir das MORNING_HOUR horas, com o que vence hoje e o que está atrasado.
   Cada aviso tem uma chave; depois de mostrado, a chave é guardada para não repetir. */

import { TYPES } from './config.js';
import { isoDay } from './dates.js';

export const LEAD_MIN = 60;
export const GRACE_MIN = 30;
export const MORNING_HOUR = 8;
export const KEEP_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function pending(items) {
  return items.filter((i) => i && !i.done && !i.example && typeof i.due === 'string' && DATE_RE.test(i.due));
}

/** 5 → "5 min", 60 → "1 h", 90 → "1 h 30 min". */
export function formatMinutes(m) {
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? h + ' h ' + r + ' min' : h + ' h';
}

function dueDate(item) {
  const [y, mo, d] = item.due.split('-').map(Number);
  const [hh, mm] = item.time.split(':').map(Number);
  return new Date(y, mo - 1, d, hh, mm);
}

function timedReminders(list, now, notified) {
  const out = [];
  list.forEach((item) => {
    if (typeof item.time !== 'string' || !TIME_RE.test(item.time)) return;
    const key = 't|' + item.id + '|' + item.due + '|' + item.time;
    if (notified[key]) return;
    const diff = Math.round((dueDate(item) - now) / 60000);
    if (diff > LEAD_MIN || diff < -GRACE_MIN) return;

    let when;
    if (diff > 1) when = 'Em ' + formatMinutes(diff);
    else if (diff >= -1) when = 'Agora';
    else when = 'Começou há ' + formatMinutes(-diff);
    out.push({
      key,
      title: (TYPES[item.type] || TYPES.atividade) + ': ' + item.title,
      body: when + ', às ' + item.time + (item.subject ? ' · ' + item.subject : ''),
      at: dueDate(item).getTime()
    });
  });
  return out.sort((a, b) => a.at - b.at).map(({ at, ...r }) => r);
}

function morningReminder(list, now, notified) {
  if (now.getHours() < MORNING_HOUR) return [];
  const day = isoDay(now);
  const key = 'd|' + day;
  if (notified[key]) return [];

  const todayItems = list.filter((i) => i.due === day);
  const late = list.filter((i) => i.due < day);
  if (todayItems.length === 0 && late.length === 0) return [];

  const parts = [];
  if (todayItems.length) {
    const shown = todayItems.slice(0, 3).map((i) => i.title).join('; ');
    const more = todayItems.length - 3;
    parts.push('Hoje: ' + shown + (more > 0 ? ' e mais ' + more : ''));
  }
  if (late.length) parts.push(late.length + (late.length === 1 ? ' atrasado' : ' atrasados'));
  return [{ key, title: 'Planner: resumo do dia', body: parts.join('. ') + '.' }];
}

/** Avisos que devem aparecer agora. `notified` é um objeto { chave: instante } com o que já foi avisado. */
export function dueReminders(items, now = new Date(), notified = {}) {
  const list = pending(items);
  return [...timedReminders(list, now, notified), ...morningReminder(list, now, notified)];
}

/** Esquece avisos com mais de KEEP_DAYS dias, para a lista não crescer para sempre. */
export function pruneNotified(notified, now = new Date()) {
  const limit = now.getTime() - KEEP_DAYS * 86400000;
  const out = {};
  Object.keys(notified || {}).forEach((k) => {
    if (typeof notified[k] === 'number' && notified[k] > limit) out[k] = notified[k];
  });
  return out;
}

/** Preferências guardadas no navegador: { enabled, notified }. Aceita lixo e devolve algo seguro. */
export function sanitizePrefs(raw) {
  const ok = raw && typeof raw === 'object' && !Array.isArray(raw);
  const notified = {};
  if (ok && raw.notified && typeof raw.notified === 'object' && !Array.isArray(raw.notified)) {
    Object.keys(raw.notified).forEach((k) => {
      if (typeof raw.notified[k] === 'number' && Number.isFinite(raw.notified[k])) notified[k] = raw.notified[k];
    });
  }
  return { enabled: Boolean(ok) && raw.enabled === true, notified };
}

/** Roda uma verificação: mostra o que for devido (com a função `show`) e devolve as preferências atualizadas.
    Só marca como avisado o que `show` confirmou (devolveu true); o resto é tentado de novo na próxima vez. */
export async function runReminders(items, now, prefs, show) {
  if (!prefs.enabled) return prefs;
  const notified = pruneNotified(prefs.notified, now);
  for (const r of dueReminders(items, now, notified)) {
    if (await show(r)) notified[r.key] = now.getTime();
  }
  return { enabled: prefs.enabled, notified };
}
