/* Backup: baixar os dados em um arquivo .json e restaurar a partir dele.
   Monta a própria seção na página (logo abaixo da lista), então não precisa mexer no index.html. */

import { STORAGE_KEY } from './config.js';
import { $, el } from './utils.js';
import { today, isoDay } from './dates.js';
import { state, ui, replaceData } from './state.js';
import { persist, getCorruptRaw } from './storage.js';
import { renderAll } from './render.js';
import { toast } from './toast.js';
import { buildBackup, parseBackup, LIMITS } from './validate.js';

const LAST_KEY = STORAGE_KEY + ':ultimo-backup';
let info = null;

function readLast() {
  try { return localStorage.getItem(LAST_KEY); } catch (e) { return null; }
}

function writeLast(value) {
  try { localStorage.setItem(LAST_KEY, value); } catch (e) { /* ignora */ }
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function refreshInfo() {
  const last = readLast();
  info.textContent = last
    ? 'Último backup baixado em ' + last.split('-').reverse().join('/') + '.'
    : 'Você ainda não baixou nenhum backup.';
}

function exportData() {
  const day = isoDay(today());
  download('planner-academico-backup-' + day + '.json', buildBackup(state.items, state.updatedAt), 'application/json');
  writeLast(day);
  refreshInfo();
  toast('Backup baixado.');
}

async function importFile(file) {
  if (!file) return;
  if (file.size > LIMITS.fileBytes) { toast('Arquivo grande demais para ser um backup.'); return; }
  let raw;
  try { raw = await file.text(); } catch (e) { toast('Não foi possível ler o arquivo.'); return; }

  const r = parseBackup(raw);
  if (!r.ok) { toast(r.error); return; }

  const ask = 'Restaurar ' + r.items.length + ' item(ns) deste backup? Os dados atuais serão substituídos. ' +
    'Logo depois você poderá desfazer.';
  if (!window.confirm(ask)) return;

  const before = state.items;
  if (ui.editingId) $('f-cancelar').click();
  replaceData({ items: r.items, updatedAt: state.updatedAt });
  persist();
  renderAll();

  let msg = 'Backup restaurado: ' + r.items.length + ' item(ns).';
  if (r.skipped > 0) msg += ' ' + r.skipped + ' ignorado(s) por estarem inválidos.';
  toast(msg, () => {
    replaceData({ items: before, updatedAt: state.updatedAt });
    persist();
    renderAll();
  });
}

function button(label, onClick) {
  const b = el('button', 'btn small', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function build() {
  const sec = el('section', 'group');
  sec.id = 'backup';
  sec.appendChild(el('h3', '', 'Backup dos seus dados'));
  sec.appendChild(el('p', 'notes',
    'Guarde uma cópia dos seus itens em um arquivo no seu aparelho. ' +
    'Se os dados do navegador forem apagados, você restaura por aqui.'));
  info = el('p', 'notes', '');
  sec.appendChild(info);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  input.setAttribute('aria-label', 'Escolher arquivo de backup');
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.value = '';
    importFile(file);
  });

  const acts = el('div', 'acts');
  acts.appendChild(button('Baixar backup', exportData));
  acts.appendChild(button('Restaurar de um arquivo', () => input.click()));
  acts.appendChild(input);

  const corrupt = getCorruptRaw();
  if (corrupt) {
    sec.appendChild(el('p', 'notes',
      'Encontramos dados antigos que não deu para ler. Uma cópia foi guardada e pode ser baixada abaixo.'));
    acts.appendChild(button('Baixar dados ilegíveis', () => {
      download('planner-dados-ilegiveis.txt', corrupt, 'text/plain');
    }));
  }
  sec.appendChild(acts);

  $('lista').insertAdjacentElement('afterend', sec);
}

/** Liga a seção de backup. Chamada uma única vez, em actions.js. */
export function bindBackup() {
  if (!$('lista')) return;
  build();
  refreshInfo();
  try {
    // Pede ao navegador para não apagar estes dados sozinho quando faltar espaço.
    const p = navigator.storage && navigator.storage.persist && navigator.storage.persist();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignora */ }
}
