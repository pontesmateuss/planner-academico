/* Agenda e lembretes: exportar os prazos para a agenda (.ics) e ativar avisos de prazo neste aparelho.
   Monta o próprio painel dentro de #ferramentas (index.html).
   A lógica de quais avisos mostrar fica em reminders.js; aqui ficam a tela, a permissão e a notificação. */

import { STORAGE_KEY } from './config.js';
import { $, download, addPanel, actionButton, panelRow } from './utils.js';
import { today, isoDay } from './dates.js';
import { state } from './state.js';
import { toast } from './toast.js';
import { buildIcs, exportableItems } from './ics.js';
import { LEAD_MIN, MORNING_HOUR, runReminders, sanitizePrefs } from './reminders.js';

const PREFS_KEY = STORAGE_KEY + ':avisos';
const CHECK_MS = 60000;

let prefs = sanitizePrefs(null);
let checking = false;
let statusEl = null;
let toggleBtn = null;

/* ---------- exportar para a agenda ---------- */

function exportAgenda() {
  const count = exportableItems(state.items).length;
  if (count === 0) {
    toast('Nenhum prazo pendente para exportar. Itens de exemplo, concluídos ou sem data ficam de fora.');
    return;
  }
  download('planner-academico-agenda-' + isoDay(today()) + '.ics', buildIcs(state.items), 'text/calendar;charset=utf-8');
  toast(count + ' prazo(s) exportado(s). Abra o arquivo baixado para adicionar à sua agenda.');
}

/* ---------- avisos neste aparelho ---------- */

function loadPrefs() {
  try { prefs = sanitizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY))); } catch (e) { prefs = sanitizePrefs(null); }
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignora */ }
}

function permission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** Mostra uma notificação. Devolve true se conseguiu. Prefere o service worker, que funciona no Android. */
async function show(r) {
  const options = { body: r.body, tag: r.key, icon: 'assets/img/icon-192.png', lang: 'pt-BR' };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(r.title, options);
    else new Notification(r.title, options);
    return true;
  } catch (e) {
    return false;
  }
}

async function check() {
  if (checking || !prefs.enabled || permission() !== 'granted') return;
  checking = true;
  try {
    prefs = await runReminders(state.items, new Date(), prefs, show);
    savePrefs();
  } finally {
    checking = false;
  }
}

function refreshAvisos() {
  const p = permission();
  let text;
  let label = 'Ativar avisos neste aparelho';
  let disabled = false;
  if (p === 'unsupported') {
    text = 'Este navegador não oferece avisos.';
    disabled = true;
  } else if (p === 'denied') {
    text = 'Os avisos estão bloqueados nas configurações do navegador. Libere o Planner por lá para poder ativar.';
    disabled = true;
  } else if (prefs.enabled && p === 'granted') {
    text = 'Avisos ativados: você é avisado ' + LEAD_MIN + ' min antes de prazos com horário e recebe um resumo do dia a partir das ' +
      MORNING_HOUR + 'h.';
    label = 'Desativar avisos';
  } else {
    text = 'Avisos desativados.';
  }
  statusEl.textContent = text;
  toggleBtn.textContent = label;
  toggleBtn.disabled = disabled;
}

async function toggleAvisos() {
  if (prefs.enabled) {
    prefs.enabled = false;
    savePrefs();
    refreshAvisos();
    toast('Avisos desativados.');
    return;
  }
  let p = permission();
  if (p === 'default') {
    try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; }
  }
  if (p !== 'granted') {
    refreshAvisos();
    toast('Sem a permissão do navegador, os avisos não podem ser ativados.');
    return;
  }
  prefs.enabled = true;
  savePrefs();
  refreshAvisos();
  toast('Avisos ativados.');
  check();
}

/* ---------- tela ---------- */

function build() {
  const { sec } = addPanel('agenda', 'Agenda e lembretes', 'Duas formas de não esquecer um prazo.');

  const exp = panelRow(
    'Levar para a agenda do celular',
    'Cada prazo pendente vira um evento, com lembrete na véspera e no dia (às 9h). ' +
    'Funciona no Google Agenda, no Calendário da Apple e no Outlook, mesmo com o Planner fechado.',
    'Exportou de novo? A agenda atualiza os mesmos eventos. Itens concluídos ou apagados continuam lá até você removê-los.');
  exp.actions.appendChild(actionButton('Exportar para a agenda', exportAgenda));
  sec.appendChild(exp.row);

  const avisos = panelRow(
    'Avisos neste aparelho',
    '',
    'Os avisos só aparecem com o Planner aberto (numa aba ou como app instalado). ' +
    'Para lembrete com o site fechado, use a agenda.');
  statusEl = avisos.desc;
  statusEl.setAttribute('role', 'status');
  toggleBtn = actionButton('', toggleAvisos);
  avisos.actions.appendChild(toggleBtn);
  sec.appendChild(avisos.row);
}

/** Liga a seção de agenda e os avisos. Chamada uma única vez, em actions.js. */
export function bindAgenda() {
  if (!$('ferramentas')) return;
  loadPrefs();
  build();
  refreshAvisos();
  check();
  setInterval(check, CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshAvisos();
      check();
    }
  });
}
