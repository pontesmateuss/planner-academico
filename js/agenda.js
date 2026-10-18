/* Agenda e lembretes: exportar os prazos para a agenda (.ics) e ativar avisos de prazo neste aparelho.
   Monta a própria seção na página (logo abaixo da lista), então não precisa mexer no index.html.
   A lógica de quais avisos mostrar fica em reminders.js; aqui ficam a tela, a permissão e a notificação. */

import { STORAGE_KEY } from './config.js';
import { $, el, download } from './utils.js';
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

function button(label, onClick) {
  const b = el('button', 'btn small', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function build() {
  const sec = el('section', 'group');
  sec.id = 'agenda';
  sec.appendChild(el('h3', '', 'Agenda e lembretes'));

  sec.appendChild(el('p', 'notes',
    'Leve seus prazos pendentes para o Google Agenda, o Calendário da Apple ou o Outlook. ' +
    'Cada prazo vira um evento com lembretes: na véspera e no dia, às 9h (se tiver horário: 1 dia e 1 hora antes).'));
  sec.appendChild(el('p', 'notes',
    'Ao exportar de novo, a agenda costuma reconhecer os mesmos eventos e atualizar, em vez de duplicar. ' +
    'Itens concluídos ou apagados depois de exportados continuam na agenda até você removê-los por lá.'));
  const exportActs = el('div', 'acts');
  exportActs.appendChild(button('Exportar prazos para a agenda (.ics)', exportAgenda));
  sec.appendChild(exportActs);

  statusEl = el('p', 'notes', '');
  statusEl.setAttribute('role', 'status');
  sec.appendChild(statusEl);
  sec.appendChild(el('p', 'notes',
    'Os avisos só aparecem enquanto o Planner está aberto (numa aba ou como app instalado); no celular, o sistema pode ' +
    'pausá-lo em segundo plano. Para lembretes que tocam com o site fechado, use a exportação para a agenda.'));
  const avisoActs = el('div', 'acts');
  toggleBtn = button('', toggleAvisos);
  avisoActs.appendChild(toggleBtn);
  sec.appendChild(avisoActs);

  $('lista').insertAdjacentElement('afterend', sec);
}

/** Liga a seção de agenda e os avisos. Chamada uma única vez, em actions.js. */
export function bindAgenda() {
  if (!$('lista')) return;
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
