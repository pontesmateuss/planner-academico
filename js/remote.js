/* Conta na nuvem (Supabase): funções puras, sem acesso à tela, que dá para testar com `node --test`.
   - createDocRef: adapta uma linha da tabela planner_docs para o formato que storage.js usa (get e set).
   - friendlyAuthError: troca o erro técnico do Supabase por uma frase em português.
   - validateCredentials: confere e-mail e senha antes de falar com o servidor.
   - describeSyncError: diz por que a leitura ou o envio dos itens para a conta falhou. */

import { SYNC_TABLE } from './config.js';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // limite do Supabase (bcrypt)

/** O erro do Supabase não traz o código HTTP (403, 500...); ele vem ao lado. Guarda no erro para describeSyncError usar. */
function withStatus(error, status) {
  try { if (error && typeof error === 'object' && error.status === undefined) error.status = status; } catch (e) { /* erro congelado: segue sem o código */ }
  return error;
}

/** Um documento por conta: `client` é o cliente do Supabase e `userId` o id de quem está logado.
    A regra de segurança (RLS, em supabase/schema.sql) garante que cada conta só alcança a própria linha. */
export function createDocRef(client, userId) {
  return {
    async get() {
      const { data, error, status } = await client.from(SYNC_TABLE).select('data').eq('user_id', userId).maybeSingle();
      if (error) throw withStatus(error, status);
      return { exists: !!data, data: () => (data ? data.data : null) };
    },
    async set(payload) {
      const row = { user_id: userId, data: payload, updated_at: new Date().toISOString() };
      const { error, status } = await client.from(SYNC_TABLE).upsert(row, { onConflict: 'user_id' });
      if (error) throw withStatus(error, status);
    }
  };
}

/** Devolve a mensagem de erro em português ('' se estiver tudo certo). `kind` é 'signup' ou 'signin'. */
export function validateCredentials(email, password, kind) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Digite um e-mail válido.';
  }
  if (typeof password !== 'string' || password.length === 0) return 'Digite a senha.';
  if (kind === 'signup') {
    if (password.length < PASSWORD_MIN) return 'Use uma senha com pelo menos ' + PASSWORD_MIN + ' caracteres.';
    if (password.length > PASSWORD_MAX) return 'A senha pode ter no máximo ' + PASSWORD_MAX + ' caracteres.';
  }
  return '';
}

/** Transforma o erro do Supabase em uma frase clara. Nunca mostra o texto técnico ao usuário. */
export function friendlyAuthError(err) {
  const msg = String((err && (err.message || err.msg)) || '');
  const code = (err && (err.code || err.error_code)) || '';
  const status = err && err.status;
  const name = (err && err.name) || '';

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'E-mail ou senha incorretos.';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|already exists/i.test(msg)) {
    return 'Este e-mail já tem conta. Use "Entrar".';
  }
  if (code === 'signup_disabled' || /signups? (not allowed|(is |are )?disabled)/i.test(msg)) {
    return 'Novos cadastros estão fechados neste site.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return 'Confirme o e-mail antes de entrar (veja a sua caixa de entrada).';
  }
  if (status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) {
    return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  }
  if (code === 'weak_password' || /password should be|weak password/i.test(msg)) {
    return 'Senha fraca. Use pelo menos ' + PASSWORD_MIN + ' caracteres.';
  }
  if (name === 'AuthRetryableFetchError' || /failed to fetch|network|load failed|fetch failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }
  return 'Não foi possível concluir. Tente de novo.';
}

/** Explica por que a sincronização falhou. Devolve { kind, text, short }:
    kind: 'no-table' (o SQL ainda não foi rodado), 'permission', 'key', 'session', 'server', 'network' ou 'other';
    text: frase completa para o painel da conta; short: frase curta para a linha de status. */
export function describeSyncError(err) {
  const msg = String((err && (err.message || err.msg)) || '');
  const code = String((err && (err.code || err.error_code)) || '');
  const status = err && err.status;
  const name = (err && err.name) || '';
  const keep = ' Seus itens seguem salvos neste aparelho.';

  if (code === 'PGRST205' || code === '42P01' || /could not find the table|relation .* does not exist/i.test(msg)) {
    return {
      kind: 'no-table',
      text: 'A tabela da conta ainda não existe no Supabase. Rode o SQL de supabase/schema.sql no painel (SQL Editor) e recarregue a página.' + keep,
      short: 'Tabela da conta não encontrada: rode o SQL do Supabase.'
    };
  }
  if (code === '42501' || status === 403 || /permission denied|row-level security/i.test(msg)) {
    return {
      kind: 'permission',
      text: 'O Supabase recusou o acesso à tabela da conta. Rode de novo o SQL de supabase/schema.sql no painel (ele refaz as permissões) e recarregue a página.' + keep,
      short: 'Acesso à tabela da conta recusado: rode o SQL do Supabase.'
    };
  }
  if (/invalid api key|no api key found/i.test(msg)) {
    return {
      kind: 'key',
      text: 'O Supabase não aceitou a chave do projeto em js/config.js. Confira a URL e a chave publishable.' + keep,
      short: 'Chave do Supabase recusada.'
    };
  }
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt/i.test(msg)) {
    return {
      kind: 'session',
      text: 'Sua sessão expirou. Saia da conta e entre de novo.' + keep,
      short: 'Sessão expirada: entre de novo.'
    };
  }
  if (typeof status === 'number' && status >= 500) {
    return {
      kind: 'server',
      text: 'O servidor da conta está com problema agora. Tente de novo em alguns minutos.' + keep,
      short: 'Servidor da conta com problema.'
    };
  }
  if (name === 'AuthRetryableFetchError' || name === 'TypeError' || /failed to fetch|network|load failed|fetch failed/i.test(msg)) {
    return {
      kind: 'network',
      text: 'Sem conexão com a conta agora.' + keep,
      short: 'Sem conexão com a conta.'
    };
  }
  const detail = code || msg.slice(0, 80) || name || '';
  return {
    kind: 'other',
    text: 'Não foi possível falar com a conta' + (detail ? ' (detalhe: ' + detail + ')' : '') + '. Recarregue a página; se continuar, avise quem mantém o site.' + keep,
    short: 'Erro da conta' + (detail ? ' (' + detail + ')' : '') + '.'
  };
}
