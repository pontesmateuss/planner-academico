/* Agenda e lembretes: exportar os prazos para a agenda do celular ou do computador (.ics).
   Monta a própria seção na página (logo abaixo da lista), então não precisa mexer no index.html. */

import { $, el, download } from './utils.js';
import { today, isoDay } from './dates.js';
import { state } from './state.js';
import { toast } from './toast.js';
import { buildIcs, exportableItems } from './ics.js';

function exportAgenda() {
  const count = exportableItems(state.items).length;
  if (count === 0) {
    toast('Nenhum prazo pendente para exportar. Itens de exemplo, concluídos ou sem data ficam de fora.');
    return;
  }
  download('planner-academico-agenda-' + isoDay(today()) + '.ics', buildIcs(state.items), 'text/calendar;charset=utf-8');
  toast(count + ' prazo(s) exportado(s). Abra o arquivo baixado para adicionar à sua agenda.');
}

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

  const acts = el('div', 'acts');
  acts.appendChild(button('Exportar prazos para a agenda (.ics)', exportAgenda));
  sec.appendChild(acts);

  $('lista').insertAdjacentElement('afterend', sec);
}

/** Liga a seção de agenda. Chamada uma única vez, em actions.js. */
export function bindAgenda() {
  if (!$('lista')) return;
  build();
}
