/* Ações do usuário: formulário, filtros, concluir, editar, excluir e remover exemplos.
   Cada ação altera o estado, salva com persist() e redesenha com render.js. */

import { $, uid } from './utils.js';
import { state, ui } from './state.js';
import { persist } from './storage.js';
import { renderAll, renderFilters, renderList } from './render.js';
import { toast } from './toast.js';
import { bindBackup } from './backup.js';
import { bindAgenda } from './agenda.js';
import { bindAccount } from './account.js';

function findItem(id) {
  return state.items.find((i) => i.id === id);
}

function toggle(id, checked) {
  const it = findItem(id);
  if (!it) return;
  it.done = checked;
  it.doneAt = checked ? Date.now() : null;
  persist();
  renderAll();
  const box = document.getElementById('chk-' + id);
  if (box) box.focus();
}

function removeItem(id) {
  const idx = state.items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const it = state.items.splice(idx, 1)[0];
  if (ui.editingId === id) resetForm();
  persist();
  renderAll();
  toast('Item excluído.', () => {
    state.items.splice(Math.min(idx, state.items.length), 0, it);
    persist();
    renderAll();
  });
}

/** Mostra ou esconde o formulário. Ao esconder, o botão "+ Nova anotação" volta a ser o ponto de partida. */
function setFormOpen(open, focusTitle) {
  $('nova').hidden = !open;
  $('abrir-form').hidden = open;
  $('abrir-form').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    $('nova').scrollIntoView({ block: 'nearest' });
    if (focusTitle) $('f-titulo').focus();
  }
}

function syncTimeField() {
  const has = !!$('f-data').value;
  $('campo-hora').hidden = !has;
  $('f-hora').disabled = !has;
  if (!has) $('f-hora').value = '';
}

function resetForm() {
  $('form').reset();
  ui.editingId = null;
  $('mais').open = false;
  syncTimeField();
  $('f-enviar').textContent = 'Adicionar';
  $('form-titulo').textContent = 'Nova anotação';
  setFormOpen(false);
}

function startEdit(id) {
  const it = findItem(id);
  if (!it) return;
  ui.editingId = id;
  $('f-titulo').value = it.title;
  $('f-tipo').value = it.type || 'atividade';
  $('f-materia').value = it.subject || '';
  $('f-data').value = it.due || '';
  syncTimeField();
  $('f-hora').value = it.due ? (it.time || '') : '';
  $('f-prio').value = it.prio || 'normal';
  $('f-notas').value = it.notes || '';
  $('mais').open = !!(it.subject || it.time || it.notes || (it.type && it.type !== 'atividade') || (it.prio && it.prio !== 'normal'));
  $('f-enviar').textContent = 'Salvar alterações';
  $('form-titulo').textContent = 'Editar anotação';
  setFormOpen(true, true);
}

function onSubmit(e) {
  e.preventDefault();
  const title = $('f-titulo').value.trim();
  if (!title) { $('f-titulo').focus(); return; }
  const due = $('f-data').value;
  const data = {
    title,
    type: $('f-tipo').value,
    subject: $('f-materia').value.trim(),
    due,
    time: due ? $('f-hora').value : '',
    prio: $('f-prio').value,
    notes: $('f-notas').value.trim()
  };
  if (ui.editingId) {
    const it = findItem(ui.editingId);
    if (it) { Object.assign(it, data); delete it.example; }
    toast('Alterações salvas.');
  } else {
    state.items.push(Object.assign({ id: uid(), done: false, doneAt: null, created: Date.now() }, data));
    ui.view = 'pendentes';
    if (ui.subject && data.subject.toLowerCase() !== ui.subject.toLowerCase()) ui.subject = '';
    toast('Adicionado à lista.');
  }
  persist();
  resetForm();
  renderAll();
  $('abrir-form').focus();
}

function isTyping(t) {
  return !!(t && t.closest && t.closest('input, select, textarea, [contenteditable], dialog[open]'));
}

/** Liga todos os eventos da página. Chamada uma única vez, em main.js. */
export function bindEvents() {
  $('form').addEventListener('submit', onSubmit);
  $('f-cancelar').addEventListener('click', () => { resetForm(); $('abrir-form').focus(); });
  $('abrir-form').addEventListener('click', () => setFormOpen(true, true));
  $('f-data').addEventListener('input', syncTimeField);
  $('nova').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { resetForm(); $('abrir-form').focus(); }
  });

  // Atalho: "N" abre a nova anotação quando não se está digitando.
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    e.preventDefault();
    setFormOpen(true, true);
  });

  // Conta, agenda e backup ficam num painel que abre por cima da página.
  const cfg = $('config');
  $('abrir-config').addEventListener('click', () => {
    if (typeof cfg.showModal === 'function') cfg.showModal();
    else cfg.setAttribute('open', '');
    $('config-titulo').focus();
  });
  $('fechar-config').addEventListener('click', () => cfg.close());
  cfg.addEventListener('click', (e) => { if (e.target === cfg) cfg.close(); });

  $('filtros').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    ui.view = b.dataset.view;
    renderAll();
    const again = document.querySelector('#filtros [data-view="' + ui.view + '"]');
    if (again) again.focus();
  });

  $('f-filtro-materia').addEventListener('change', (e) => {
    ui.subject = e.target.value;
    renderFilters();
    renderList();
  });

  $('lista').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const li = b.closest('li[data-id]');
    if (!li) return;
    if (b.dataset.act === 'edit') startEdit(li.dataset.id);
    else if (b.dataset.act === 'del') removeItem(li.dataset.id);
  });

  $('lista').addEventListener('change', (e) => {
    const c = e.target;
    if (c && c.matches && c.matches('input[type="checkbox"]')) {
      const li = c.closest('li[data-id]');
      if (li) toggle(li.dataset.id, c.checked);
    }
  });

  $('rm-exemplos').addEventListener('click', () => {
    const before = state.items.slice();
    state.items = state.items.filter((i) => !i.example);
    persist();
    renderAll();
    toast('Exemplos removidos.', () => { state.items = before; persist(); renderAll(); });
  });

  // A ordem aqui é a ordem dos painéis na página.
  bindAccount();
  bindAgenda();
  bindBackup();
}
