/* Ações do usuário: formulário, filtros, concluir, editar, excluir e remover exemplos.
   Cada ação altera o estado, salva com persist() e redesenha com render.js. */

import { $, uid } from './utils.js';
import { state, ui } from './state.js';
import { persist } from './storage.js';
import { renderAll, renderFilters, renderList } from './render.js';
import { toast } from './toast.js';

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

function resetForm() {
  $('form').reset();
  ui.editingId = null;
  $('f-hora').disabled = true;
  $('f-cancelar').hidden = true;
  $('f-enviar').textContent = 'Adicionar';
  $('form-titulo').textContent = 'Nova anotação';
}

function startEdit(id) {
  const it = findItem(id);
  if (!it) return;
  ui.editingId = id;
  $('f-titulo').value = it.title;
  $('f-tipo').value = it.type || 'atividade';
  $('f-materia').value = it.subject || '';
  $('f-data').value = it.due || '';
  $('f-hora').disabled = !it.due;
  $('f-hora').value = it.due ? (it.time || '') : '';
  $('f-prio').value = it.prio || 'normal';
  $('f-notas').value = it.notes || '';
  $('f-cancelar').hidden = false;
  $('f-enviar').textContent = 'Salvar alterações';
  $('form-titulo').textContent = 'Editar anotação';
  $('form-titulo').scrollIntoView({ block: 'start' });
  $('f-titulo').focus();
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
  $('f-titulo').focus();
}

/** Liga todos os eventos da página. Chamada uma única vez, em main.js. */
export function bindEvents() {
  $('form').addEventListener('submit', onSubmit);
  $('f-cancelar').addEventListener('click', resetForm);

  $('f-data').addEventListener('input', (e) => {
    const h = $('f-hora');
    h.disabled = !e.target.value;
    if (!e.target.value) h.value = '';
  });

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
}
