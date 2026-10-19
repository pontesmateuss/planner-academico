/* Conta e sincronização: login com e-mail e senha (Supabase) e salvamento dos itens na conta.
   Monta a própria seção na página (logo abaixo da lista), então não precisa mexer no index.html.
   A biblioteca do Supabase vem de vendor/ (arquivo guardado no repositório, carregado por <script> no index.html)
   e aparece como window.supabase. Se ela não carregar, o site segue só com o navegador.
   Os itens são enviados por storage.js (connectRemote); a tradução de erros e a regra da linha na tabela ficam em remote.js. */

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { $, el } from './utils.js';
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
  parts.intro.hidden = !!session;
  parts.form.hidden = !!session;
  parts.who.hidden = !session;
  if (session) parts.whoText.textContent = 'Conectado como ' + email + '. Seus itens são salvos na conta e aparecem nos seus outros aparelhos.';
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

function button(label, onClick, cls) {
  const b = el('button', cls || 'btn small', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

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
  const sec = el('section', 'group');
  sec.id = 'conta';
  sec.appendChild(el('h3', '', 'Conta e sincronização'));

  parts.intro = el('p', 'notes',
    'Entre com seu e-mail e uma senha para ver os mesmos itens no celular e no computador. ' +
    'Use uma senha só para o Planner (não a do seu e-mail). Sem conta, tudo continua funcionando e salvo neste aparelho.');
  sec.appendChild(parts.intro);

  parts.form = document.createElement('form');
  parts.form.noValidate = true;
  parts.form.setAttribute('aria-label', 'Entrar ou criar conta');
  const mail = field('conta-email', 'E-mail', 'email', 'username');
  const pass = field('conta-senha', 'Senha (mínimo ' + PASSWORD_MIN + ' caracteres para criar a conta)', 'password', 'current-password');
  parts.email = mail.input;
  parts.password = pass.input;
  parts.form.appendChild(mail.box);
  parts.form.appendChild(pass.box);

  const acts = el('div', 'acts');
  parts.signIn = el('button', 'btn small primary', 'Entrar');
  parts.signIn.type = 'submit';
  parts.signUp = button('Criar conta', () => {
    parts.password.setAttribute('autocomplete', 'new-password');
    run('signup');
  });
  acts.appendChild(parts.signIn);
  acts.appendChild(parts.signUp);
  parts.form.appendChild(acts);
  parts.form.addEventListener('submit', (e) => {
    e.preventDefault();
    parts.password.setAttribute('autocomplete', 'current-password');
    run('signin');
  });
  sec.appendChild(parts.form);

  parts.who = el('div', 'group');
  parts.who.hidden = true;
  parts.whoText = el('p', 'notes', '');
  parts.who.appendChild(parts.whoText);
  const outActs = el('div', 'acts');
  parts.signOut = button('Sair da conta', signOut);
  outActs.appendChild(parts.signOut);
  parts.who.appendChild(outActs);
  sec.appendChild(parts.who);

  parts.msg = el('p', 'notes', '');
  parts.msg.setAttribute('role', 'status');
  parts.msg.setAttribute('aria-live', 'polite');
  sec.appendChild(parts.msg);

  $('lista').insertAdjacentElement('afterend', sec);
}

/** Liga a seção de conta. Chamada uma única vez, em actions.js. */
export function bindAccount() {
  if (!$('lista')) return;
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
