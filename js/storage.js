/* Salvamento: sempre no navegador (localStorage) e, quando disponível, também na conta (capacidade db).
   Quando a conta traz dados mais novos, avisa a tela por meio do callback registrado em onRemoteChange. */

import { STORAGE_KEY, REMOTE_DOC, SAVE_DELAY_MS, STATUS_TEXT } from './config.js';
import { $ } from './utils.js';
import { state, replaceData, hasExamples } from './state.js';

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

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.items)) {
        replaceData(d);
        return true;
      }
    }
  } catch (e) { /* sem acesso ao armazenamento do navegador */ }
  return false;
}

function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
}

/** Chame depois de qualquer alteração em state.items. */
export function persist() {
  state.updatedAt = Date.now();
  state.examples = hasExamples();
  saveLocal();
  if (!docRef) { setStatus('local'); return; }
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
      replaceData({ items: d.items, updatedAt: remoteTime });
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
