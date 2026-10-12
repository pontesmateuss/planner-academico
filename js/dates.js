/* Datas e prazos. Funções puras, sem acesso à tela nem ao armazenamento. */

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isoDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function formatLongDate(d) {
  return fmtLongo.format(d);
}

export function parseDue(item) {
  if (!item.due) return null;
  const p = item.due.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

/** Dias até o prazo: negativo se atrasado, null se não tem prazo. */
export function diffDays(item) {
  const d = parseDue(item);
  if (!d) return null;
  return Math.round((d - today()) / 86400000);
}

export function dueLabel(item) {
  const d = diffDays(item);
  if (d === null) return 'Sem prazo';
  let txt = fmtDia.format(parseDue(item));
  if (item.time) txt += ' às ' + item.time;
  if (item.done) return txt;
  let rel;
  if (d === 0) rel = 'hoje';
  else if (d === 1) rel = 'amanhã';
  else if (d === -1) rel = 'ontem';
  else if (d > 1) rel = 'em ' + d + ' dias';
  else rel = 'há ' + (-d) + ' dias';
  return txt + ' · ' + rel;
}

export function groupOf(item) {
  const d = diffDays(item);
  if (d === null) return 'sem';
  if (d < 0) return 'atras';
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanha';
  if (d <= 7) return 'semana';
  return 'depois';
}

/** Ordem da lista: prazo, horário, prioridade e, por último, ordem de criação. */
export function compareItems(a, b) {
  const da = a.due || '9999-99-99';
  const db = b.due || '9999-99-99';
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.time || '99:99';
  const tb = b.time || '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  const pr = { alta: 0, normal: 1, baixa: 2 };
  if (pr[a.prio] !== pr[b.prio]) return pr[a.prio] - pr[b.prio];
  return (a.created || 0) - (b.created || 0);
}
