/* Salvamento: sempre no navegador (localStorage) e, quando disponível, também na conta (capacidade db).
   Quando a conta traz dados mais novos, avisa a tela por meio do callback registrado em onRemoteChange.
   Dados ilegíveis nunca são apagados: uma cópia fica guardada em CORRUPT_KEY. */

import { STORAGE_KEY, REMOTE_DOC, SAVE_DELAY_MS, STATUS_TEXT } from './config.js';
import { $ } from './utils.js';
import { state, replaceData, hasExamples } from './state.js';
import { sanitizeItems } from './validate.js';

const CORRUPT_KEY = STORAGE_KEY + ':corrompido';
const LOCAL_ERROR_TEXT = 'Não foi possível salvar neste navegador. Baixe um backup.';

let docRef = null;
let writing = false;
let again = false;
let saveTimer = null;
let onRemoteChange = () => {};

export function setRemoteChangeHandler(fn) {
  onRemoteChange = fn;
}

export function setStatus(kind) {
  $('status').textContent = STATUS_TEXT[kind] || '';
}

function setStatusText(text) {
  $('status').textContent = text;
}

/** Guarda uma cópia do que não deu para ler, para o usuário ainda poder recuperar. */
function keepCorrupt(raw) {
  try { localStorage.setItem(CORRUPT_KEY, raw); } catch (e) { /* sem espaço: nada a fazer */ }
}

/** Texto guardado quando os dados do navegador estavam ilegíveis (ou null). */
export function getCorruptRaw() {
  try { return localStorage.getItem(CORRUPT_KEY); } catch (e) { return null; }
}

export function loadLocal() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (d && Array.isArray(d.items)) {
      const r = sanitizeItems(d.items);
      if (r.skipped > 0) keepCorrupt(raw);
      if (r.items.length === 0 && r.skipped > 0) return false;
      replaceData({ items: r.items, updatedAt: d.updatedAt });
      return true;
    }
  } catch (e) { /* conteúdo ilegível: guardado abaixo */ }
  keepCorrupt(raw);
  return false;
}

/** Devolve true se salvou no navegador. */
function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

/** Chame depois de qualquer alteração em state.items. */
export function persist() {
  state.updatedAt = Date.now();
  state.examples = hasExamples();
  const saved = saveLocal();
  if (!docRef) {
    if (saved) setStatus('local');
    else setStatusText(LOCAL_ERROR_TEXT);
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; flush(); }, SAVE_DELAY_MS);
}

async function flush() {
  if (!docRef) return;
  if (writing) { again = true; return; }
  writing = true;
  setStatus('saving');
  const payload = JSON.parse(JSON.stringify({ items: state.items, updatedAt: state.updatedAt }));
  try {
    await docRef.set(payload);
    setStatus('synced');
  } catch (e) {
    setStatus('error');
  } finally {
    writing = false;
    if (again) { again = false; flush(); }
  }
}

/** Compara a conta com o navegador e fica com o mais recente. */
export async function pull() {
  if (!docRef || writing || saveTimer) return;
  try {
    const snap = await docRef.get();
    if (!snap.exists) {
      if (state.updatedAt > 0) flush();
      setStatus('synced');
      return;
    }
    const d = snap.data() || {};
    const remoteTime = d.updatedAt || 0;
    if (Array.isArray(d.items) && remoteTime > state.updatedAt) {
      replaceData({ items: sanitizeItems(d.items).items, updatedAt: remoteTime });
      saveLocal();
      onRemoteChange();
    } else if (state.updatedAt > remoteTime) {
      flush();
    }
    setStatus('synced');
  } catch (e) {
    setStatus('error');
  }
}

/** Liga o salvamento na conta. Se a capacidade não existir, o site segue só com o navegador. */
export async function initRemote() {
  try {
    if (!window.claude || !window.claude.use) return;
    const db = await window.claude.use('db');
    const user = await window.claude.use('user');
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    docRef = db.doc('data/users/' + id + '/' + REMOTE_DOC);
    await pull();
  } catch (e) {
    docRef = null;
    if (state.updatedAt > 0) setStatus('local');
  }
}
