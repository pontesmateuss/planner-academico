/* Conta e sincronização: login com e-mail e senha (Supabase) e salvamento dos itens na conta.
   Monta o próprio painel dentro de #ferramentas (index.html).
   A biblioteca do Supabase vem de vendor/ (arquivo guardado no repositório, carregado por <script> no index.html)
   e aparece como window.supabase. Se ela não carregar, o site segue só com o navegador.
   Os itens são enviados por storage.js (connectRemote); a tradução de erros e a regra da linha na tabela ficam em remote.js. */

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { $, el, addPanel, actionButton, panelRow } from './utils.js';
import { toast } from './toast.js';
import { connectRemote, disconnectRemote } from './storage.js';
import { refreshBackupExtras } from './backup.js';
import { createDocRef, validateCredentials, friendlyAuthError, PASSWORD_MIN } from './remote.js';

let client = null;
let userId = null;
let busy = false;
const parts = {};

function say(text) {
  parts.msg.textContent = text;
}

function setBusy(value) {
  busy = value;
  [parts.email, parts.password, parts.signIn, parts.signUp, parts.signOut].forEach((node) => {
    if (node) node.disabled = value;
  });
}

/** Alterna entre o formulário (sem login) e o resumo da conta (com login). */
function showView(session) {
  const email = session && session.user ? session.user.email : '';
  parts.lead.hidden = !!session;
  parts.form.hidden = !!session;
  parts.who.hidden = !session;
  if (session) parts.whoTitle.textContent = 'Conectado como ' + email;
}

function resultMessage(r) {
  switch (r.action) {
    case 'applied-remote':
      return 'Itens da conta carregados.' + (r.keptCopy
        ? ' Os itens que estavam só neste aparelho ficaram numa cópia (veja a seção Backup).'
        : '');
    case 'pushed-local':
      return 'Itens deste aparelho enviados para a conta.' + (r.keptCopy
        ? ' Os que estavam na conta ficaram numa cópia (veja a seção Backup).'
        : '');
    case 'locked':
      return 'Os dados da conta são de uma versão mais nova do app. Atualize a página.';
    case 'error':
      return 'Conectado, mas não foi possível sincronizar agora. Seus itens seguem salvos neste aparelho.';
    default:
      return 'Conectado. Tudo já estava igual.';
  }
}

/** Reage a qualquer mudança de login (entrar, sair, sessão guardada de uma visita anterior). */
async function onSession(session) {
  const id = session && session.user ? session.user.id : null;
  if (id === userId) { showView(session); return; }
  userId = id;
  showView(session);
  if (!id) {
    disconnectRemote();
    return;
  }
  say('Sincronizando…');
  const result = await connectRemote(createDocRef(client, id));
  if (userId !== id) return; // saiu ou trocou de conta enquanto sincronizava
  say('');
  refreshBackupExtras();
  toast(resultMessage(result));
}

async function run(kind) {
  if (busy || !client) return;
  const email = parts.email.value.trim();
  const password = parts.password.value;
  const bad = validateCredentials(email, password, kind);
  if (bad) { say(bad); return; }

  setBusy(true);
  say(kind === 'signup' ? 'Criando a conta…' : 'Entrando…');
  try {
    const res = kind === 'signup'
      ? await client.auth.signUp({ email, password })
      : await client.auth.signInWithPassword({ email, password });
    if (res.error) { say(friendlyAuthError(res.error)); return; }
    parts.password.value = '';
    if (!res.data || !res.data.session) {
      say('Conta criada. Falta confirmar o e-mail: abra a mensagem que enviamos, confirme e depois entre aqui.');
      return;
    }
    say(''); // o restante acontece em onSession, chamado pelo evento de login
  } catch (e) {
    say(friendlyAuthError(e));
  } finally {
    setBusy(false);
  }
}

async function signOut() {
  if (busy || !client) return;
  setBusy(true);
  try {
    await client.auth.signOut();
    toast('Você saiu da conta. Seus itens continuam salvos neste aparelho.');
  } catch (e) {
    say(friendlyAuthError(e));
  } finally {
    setBusy(false);
  }
}

/* ---------- tela ---------- */

function field(id, label, type, autocomplete) {
  const box = el('div', 'field');
  const lab = el('label', '', label);
  lab.htmlFor = id;
  const input = el('input', 'control');
  input.id = id;
  input.type = type;
  input.setAttribute('autocomplete', autocomplete);
  box.appendChild(lab);
  box.appendChild(input);
  return { box, input };
}

function build() {
  const panel = addPanel('conta', 'Conta e sincronização',
    'Entre para ver os mesmos itens no celular e no computador. Sem conta, tudo continua funcionando e fica salvo só neste aparelho.');
  const sec = panel.sec;
  parts.lead = panel.lead;

  // Formulário (sem login): e-mail e senha lado a lado, botões embaixo.
  parts.form = document.createElement('form');
  parts.form.noValidate = true;
  parts.form.setAttribute('aria-label', 'Entrar ou criar conta');
  const mail = field('conta-email', 'E-mail', 'email', 'username');
  const pass = field('conta-senha', 'Senha', 'password', 'current-password');
  parts.email = mail.input;
  parts.password = pass.input;
  const fields = el('div', 'panel-fields');
  fields.appendChild(mail.box);
  fields.appendChild(pass.box);
  parts.form.appendChild(fields);

  const acts = el('div', 'panel-actions');
  parts.signIn = actionButton('Entrar', null, true);
  parts.signIn.type = 'submit';
  parts.signUp = actionButton('Criar conta', () => {
    parts.password.setAttribute('autocomplete', 'new-password');
    run('signup');
  });
  acts.appendChild(parts.signIn);
  acts.appendChild(parts.signUp);
  parts.form.appendChild(acts);
  parts.form.appendChild(el('p', 'hint',
    'Primeira vez aqui? Preencha e escolha "Criar conta". Use uma senha de pelo menos ' + PASSWORD_MIN +
    ' caracteres, só para o Planner (não a do seu e-mail).'));
  parts.form.addEventListener('submit', (e) => {
    e.preventDefault();
    parts.password.setAttribute('autocomplete', 'current-password');
    run('signin');
  });
  sec.appendChild(parts.form);

  // Resumo (com login): quem está conectado e o botão de sair.
  const who = panelRow('Conectado', 'Seus itens são salvos na conta e aparecem nos seus outros aparelhos.');
  parts.who = who.row;
  parts.whoTitle = who.title;
  parts.signOut = actionButton('Sair da conta', signOut);
  who.actions.appendChild(parts.signOut);
  parts.who.hidden = true;
  sec.appendChild(parts.who);

  parts.msg = el('p', 'panel-msg', '');
  parts.msg.setAttribute('role', 'status');
  parts.msg.setAttribute('aria-live', 'polite');
  sec.appendChild(parts.msg);
}

/** Liga a seção de conta. Chamada uma única vez, em actions.js. */
export function bindAccount() {
  if (!$('ferramentas')) return;
  build();
  const lib = typeof window !== 'undefined' ? window.supabase : null;
  if (!lib || typeof lib.createClient !== 'function') {
    parts.form.hidden = true;
    say('A sincronização não está disponível agora (a biblioteca não carregou). Seus itens seguem salvos neste aparelho.');
    return;
  }
  try {
    client = lib.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    parts.form.hidden = true;
    say('A sincronização não está disponível agora. Seus itens seguem salvos neste aparelho.');
    return;
  }
  // Não faça chamadas ao Supabase de dentro do callback: o setTimeout evita travar a biblioteca.
  client.auth.onAuthStateChange((event, session) => {
    setTimeout(() => { onSession(session); }, 0);
  });
}
