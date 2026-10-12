/* Consultas sobre o estado: filtro por matéria e contagens dos botões de prazo. */

import { state, ui } from './state.js';
import { diffDays } from './dates.js';

export function bySubject() {
  if (!ui.subject) return state.items.slice();
  const s = ui.subject.toLowerCase();
  return state.items.filter((i) => (i.subject || '').toLowerCase() === s);
}

export function subjectNames() {
  const set = {};
  state.items.forEach((i) => { if (i.subject) set[i.subject] = true; });
  return Object.keys(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function counts() {
  const c = { pendentes: 0, hoje: 0, semana: 0, atrasadas: 0, concluidas: 0 };
  bySubject().forEach((it) => {
    if (it.done) { c.concluidas++; return; }
    c.pendentes++;
    const d = diffDays(it);
    if (d !== null) {
      if (d < 0) c.atrasadas++;
      if (d === 0) c.hoje++;
      if (d >= 0 && d <= 7) c.semana++;
    }
  });
  return c;
}
