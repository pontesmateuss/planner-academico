/* Conta na nuvem (Supabase): funções puras, sem acesso à tela, que dá para testar com `node --test`.
   - createDocRef: adapta uma linha da tabela planner_docs para o formato que storage.js usa (get e set).
   - friendlyAuthError: troca o erro técnico do Supabase por uma frase em português.
   - validateCredentials: confere e-mail e senha antes de falar com o servidor. */

import { SYNC_TABLE } from './config.js';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // limite do Supabase (bcrypt)

/** Um documento por conta: `client` é o cliente do Supabase e `userId` o id de quem está logado.
    A regra de segurança (RLS, em supabase/schema.sql) garante que cada conta só alcança a própria linha. */
export function createDocRef(client, userId) {
  return {
    async get() {
      const { data, error } = await client.from(SYNC_TABLE).select('data').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return { exists: !!data, data: () => (data ? data.data : null) };
    },
    async set(payload) {
      const row = { user_id: userId, data: payload, updated_at: new Date().toISOString() };
      const { error } = await client.from(SYNC_TABLE).upsert(row, { onConflict: 'user_id' });
      if (error) throw error;
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
