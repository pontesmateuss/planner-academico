/* Itens de exemplo mostrados na primeira abertura. Ficam marcados com example: true. */

import { today, isoDay } from './dates.js';
import { uid } from './utils.js';

export function seedItems() {
  const t = today();
  const iso = (n) => isoDay(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n));
  let n = 0;
  const mk = (o) => Object.assign({
    id: uid(), done: false, doneAt: null, notes: '', time: '', prio: 'normal',
    subject: '', due: '', example: true, created: Date.now() + (n++)
  }, o);

  return [
    mk({ title: 'Resolver a lista 4 de exercícios', type: 'atividade', subject: 'Cálculo I', due: iso(2), prio: 'alta', notes: 'Questões 1 a 12.' }),
    mk({ title: 'Prova sobre soluções e concentração', type: 'prova', subject: 'Química', due: iso(5), time: '07:30' }),
    mk({ title: 'Entregar o resumo do artigo', type: 'trabalho', subject: 'Sociologia', due: iso(1) }),
    mk({ title: 'Relatório da aula de laboratório', type: 'trabalho', subject: 'Física', due: iso(-1), prio: 'alta' }),
    mk({ title: 'Pedir o livro na biblioteca', type: 'lembrete' }),
    mk({ title: 'Ler o capítulo 3', type: 'atividade', subject: 'História', due: iso(-3), done: true, doneAt: Date.now() - 3600000 })
  ];
}
