/* Funções pequenas de apoio ao DOM. Não depende de nenhum outro módulo. */

export function $(id) {
  return document.getElementById(id);
}

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Baixa um texto como arquivo (backup, agenda...). */
export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- painéis de ferramentas (conta, agenda e backup) ---------- */

/** Botão de ação de um painel. `primary` destaca a ação principal. */
export function actionButton(label, onClick, primary) {
  const b = el('button', 'btn' + (primary ? ' primary' : ''), label);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** Cria um painel (cartão) com título e uma frase de explicação dentro de #ferramentas.
    Os painéis aparecem na ordem em que são criados. Devolve { sec, lead }. */
export function addPanel(id, title, lead) {
  const sec = el('section', 'panel');
  sec.id = id;
  const h = el('h3', '', title);
  h.id = id + '-titulo';
  sec.setAttribute('aria-labelledby', h.id);
  sec.appendChild(h);
  const leadEl = lead ? el('p', 'panel-lead', lead) : null;
  if (leadEl) sec.appendChild(leadEl);
  $('ferramentas').appendChild(sec);
  return { sec, lead: leadEl };
}

/** Linha de um painel: texto à esquerda (título, descrição e nota opcional) e botões à direita.
    Devolve { row, title, desc, actions }: coloque os botões em `actions`. */
export function panelRow(title, desc, note) {
  const row = el('div', 'panel-row');
  const text = el('div', 'row-text');
  const titleEl = el('p', 'row-title', title);
  const descEl = el('p', 'row-desc', desc || '');
  text.appendChild(titleEl);
  text.appendChild(descEl);
  if (note) text.appendChild(el('p', 'hint', note));
  const actions = el('div', 'panel-actions');
  row.appendChild(text);
  row.appendChild(actions);
  return { row, title: titleEl, desc: descEl, actions };
}
