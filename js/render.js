/* Desenho da tela: data, filtros, lista de matérias e lista de itens.
   Lê o estado e monta o HTML; não altera dados. */

import { TYPES, GROUPS, VIEWS, EMPTY } from './config.js';
import { $, el } from './utils.js';
import { today, isoDay, formatLongDate, diffDays, dueLabel, groupOf, compareItems } from './dates.js';
import { state, ui, hasExamples } from './state.js';
import { bySubject, subjectNames, counts } from './selectors.js';

let dayKey = '';

export function renderDate() {
  $('data-hoje').textContent = formatLongDate(new Date());
  dayKey = isoDay(today());
}

/** Verdadeiro quando a meia-noite passou e a tela precisa ser redesenhada. */
export function dayChanged() {
  return isoDay(today()) !== dayKey;
}

export function renderFilters() {
  const box = $('filtros');
  const c = counts();
  box.replaceChildren();
  VIEWS.forEach(([key, label]) => {
    const b = el('button', 'chip-btn');
    b.type = 'button';
    b.dataset.view = key;
    b.setAttribute('aria-pressed', ui.view === key ? 'true' : 'false');
    b.appendChild(el('span', '', label));
    b.appendChild(el('span', 'n', String(c[key])));
    box.appendChild(b);
  });
}

export function renderSubjects() {
  const names = subjectNames();
  if (ui.subject && !names.some((n) => n.toLowerCase() === ui.subject.toLowerCase())) ui.subject = '';

  const sel = $('f-filtro-materia');
  sel.replaceChildren();
  const all = el('option', '', 'Todas as matérias');
  all.value = '';
  sel.appendChild(all);
  names.forEach((n) => {
    const o = el('option', '', n);
    o.value = n;
    if (ui.subject && n.toLowerCase() === ui.subject.toLowerCase()) o.selected = true;
    sel.appendChild(o);
  });

  const dl = $('lista-materias');
  dl.replaceChildren();
  names.forEach((n) => {
    const o = document.createElement('option');
    o.value = n;
    dl.appendChild(o);
  });
}

function itemEl(it) {
  const li = el('li', 'item' + (it.done ? ' done' : ''));
  li.dataset.id = it.id;

  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.id = 'chk-' + it.id;
  chk.checked = !!it.done;
  chk.setAttribute('aria-label', (it.done ? 'Reabrir: ' : 'Concluir: ') + it.title);
  li.appendChild(chk);

  const body = el('div', 'body');
  body.appendChild(el('p', 'title', it.title));
  const meta = el('p', 'meta');
  meta.appendChild(el('span', 'tag ' + it.type, TYPES[it.type] || 'Atividade'));
  if (it.subject) meta.appendChild(el('span', 'subj', it.subject));
  const d = diffDays(it);
  const late = !it.done && d !== null && d < 0;
  meta.appendChild(el('span', 'due' + (late ? ' late' : ''), dueLabel(it)));
  if (it.prio === 'alta' && !it.done) meta.appendChild(el('span', 'tag prio', 'Prioridade alta'));
  body.appendChild(meta);
  if (it.notes) body.appendChild(el('p', 'notes', it.notes));
  li.appendChild(body);

  const acts = el('div', 'acts');
  const edit = el('button', 'btn small', 'Editar');
  edit.type = 'button';
  edit.dataset.act = 'edit';
  edit.setAttribute('aria-label', 'Editar: ' + it.title);
  const del = el('button', 'btn small', 'Excluir');
  del.type = 'button';
  del.dataset.act = 'del';
  del.setAttribute('aria-label', 'Excluir: ' + it.title);
  acts.appendChild(edit);
  acts.appendChild(del);
  li.appendChild(acts);
  return li;
}

function groupEl(label, items) {
  const sec = el('section', 'group');
  const h = el('h3', '', label);
  h.appendChild(el('span', 'n', String(items.length)));
  sec.appendChild(h);
  const ul = el('ul', 'items');
  items.forEach((it) => ul.appendChild(itemEl(it)));
  sec.appendChild(ul);
  return sec;
}

export function renderList() {
  const box = $('lista');
  box.replaceChildren();
  const all = bySubject();
  const pending = all.filter((i) => !i.done);
  const done = all.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  if (ui.view === 'concluidas') {
    if (!done.length) box.appendChild(el('p', 'empty', EMPTY.concluidas));
    else box.appendChild(groupEl('Concluídas', done));
    return;
  }

  let list = pending;
  if (ui.view === 'hoje') list = pending.filter((i) => diffDays(i) === 0);
  else if (ui.view === 'semana') list = pending.filter((i) => { const d = diffDays(i); return d !== null && d >= 0 && d <= 7; });
  else if (ui.view === 'atrasadas') list = pending.filter((i) => { const d = diffDays(i); return d !== null && d < 0; });
  list = list.slice().sort(compareItems);

  const by = {};
  list.forEach((i) => { const k = groupOf(i); (by[k] || (by[k] = [])).push(i); });
  let any = false;
  GROUPS.forEach(([key, label]) => {
    if (by[key]) { any = true; box.appendChild(groupEl(label, by[key])); }
  });
  if (!any) box.appendChild(el('p', 'empty', EMPTY[ui.view]));

  if (ui.view === 'pendentes' && done.length) {
    const det = el('details', 'donebox');
    det.open = ui.doneOpen;
    det.appendChild(el('summary', '', 'Concluídas (' + done.length + ')'));
    const ul = el('ul', 'items');
    done.forEach((it) => ul.appendChild(itemEl(it)));
    det.appendChild(ul);
    det.addEventListener('toggle', () => { ui.doneOpen = det.open; });
    box.appendChild(det);
  }
}

export function renderNotice() {
  $('aviso-exemplos').hidden = !hasExamples();
}

export function renderAll() {
  renderDate();
  renderSubjects();
  renderFilters();
  renderNotice();
  renderList();
}
