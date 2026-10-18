/* Validação e limpeza de dados (backup, leitura do navegador e da conta).
   Funções puras, sem acesso à tela: podem ser testadas com `node --test`. */

import { uid } from './utils.js';

export const LIMITS = {
  title: 140,
  subject: 80,
  notes: 500,
  items: 5000,
  fileBytes: 5 * 1024 * 1024
};

const PRIOS = ['alta', 'normal', 'baixa'];

/** Versão atual do formato dos dados salvos. Suba este número a cada mudança no formato
    e crie a migração correspondente em MIGRATIONS (veja "Versão dos dados" no README). */
export const DATA_VERSION = 1;

/* MIGRATIONS[n] converte dados da versão n para a versão n + 1.
   Cada uma recebe o objeto inteiro ({ items, updatedAt, ... }) e devolve um objeto novo,
   sem alterar o recebido. Dados sem número de versão (salvos antes desta mudança) são versão 0. */
const MIGRATIONS = {
  // 0 → 1: o formato passou a registrar o número da versão; os itens continuam iguais.
  0: (d) => ({ ...d })
};

/** Leva dados de qualquer versão antiga até a atual.
    Devolve { ok: true, data, migrated, from } ou { ok: false, reason: 'future' | 'invalid' }.
    'future' = os dados vieram de uma versão mais nova do app: nunca devem ser reescritos por esta. */
export function migrate(data, migrations = MIGRATIONS, target = DATA_VERSION) {
  const d = Array.isArray(data) ? { items: data } : data;
  if (!d || typeof d !== 'object' || !Array.isArray(d.items)) return { ok: false, reason: 'invalid' };
  let version = d.version === undefined ? 0 : d.version;
  if (!Number.isInteger(version) || version < 0) return { ok: false, reason: 'invalid' };
  if (version > target) return { ok: false, reason: 'future' };

  const from = version;
  let cur = d;
  while (version < target) {
    const step = migrations[version];
    if (typeof step !== 'function') return { ok: false, reason: 'invalid' };
    try { cur = step(cur); } catch (e) { return { ok: false, reason: 'invalid' }; }
    if (!cur || !Array.isArray(cur.items)) return { ok: false, reason: 'invalid' };
    version++;
  }
  return { ok: true, data: { ...cur, version }, migrated: version !== from, from };
}

function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function validTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function text(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function stamp(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Devolve um item limpo (só os campos conhecidos, com valores válidos) ou null se não der para aproveitar. */
export function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = text(raw.title, LIMITS.title);
  if (!title) return null;

  const due = validDate(raw.due) ? raw.due : '';
  const done = raw.done === true;
  const item = {
    id: typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid(),
    title,
    type: typeof raw.type === 'string' && /^[a-z_-]{1,20}$/.test(raw.type) ? raw.type : 'atividade',
    subject: text(raw.subject, LIMITS.subject),
    due,
    time: due && validTime(raw.time) ? raw.time : '',
    prio: PRIOS.includes(raw.prio) ? raw.prio : 'normal',
    notes: text(raw.notes, LIMITS.notes),
    done,
    doneAt: done ? stamp(raw.doneAt, Date.now()) : null,
    created: stamp(raw.created, Date.now())
  };
  if (raw.example === true) item.example = true;
  return item;
}

/** Limpa uma lista inteira. `skipped` conta o que foi descartado (item inválido ou id repetido). */
export function sanitizeItems(list) {
  if (!Array.isArray(list)) return { items: [], skipped: 0 };
  const seen = new Set();
  const items = [];
  let skipped = 0;
  list.forEach((raw) => {
    const it = sanitizeItem(raw);
    if (!it || seen.has(it.id)) { skipped++; return; }
    seen.add(it.id);
    items.push(it);
  });
  return { items, skipped };
}

/** Monta o texto do arquivo de backup. */
export function buildBackup(items, updatedAt, now = new Date()) {
  return JSON.stringify({
    app: 'planner-academico',
    version: DATA_VERSION,
    exportedAt: now.toISOString(),
    updatedAt: updatedAt || 0,
    items
  }, null, 2);
}

/** Lê o texto de um backup. Devolve { ok: true, items, skipped } ou { ok: false, error }. */
export function parseBackup(raw) {
  if (typeof raw !== 'string' || raw.length > LIMITS.fileBytes) {
    return { ok: false, error: 'Arquivo grande demais para ser um backup.' };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: 'Este arquivo não é um backup válido (não foi possível ler o conteúdo).' };
  }
  const m = migrate(data);
  if (!m.ok) {
    return {
      ok: false,
      error: m.reason === 'future'
        ? 'Este backup foi feito por uma versão mais nova do Planner. Atualize a página e tente de novo.'
        : 'Este arquivo não parece ser um backup do Planner (formato desconhecido).'
    };
  }
  const list = m.data.items;
  if (list.length > LIMITS.items) {
    return { ok: false, error: 'O backup tem itens demais (limite: ' + LIMITS.items + ').' };
  }
  const { items, skipped } = sanitizeItems(list);
  if (list.length > 0 && items.length === 0) {
    return { ok: false, error: 'Nenhum item válido foi encontrado no arquivo.' };
  }
  return { ok: true, items, skipped };
}
